import os
import uuid
import io
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from Wazuh import WazuhSDK
from groq import Groq
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from s3 import s3
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Import federated learning components
from federatedServer import (
    Config as FederatedConfig,
    NodeRegistry,
    FedAvgEngine,
    AnomalyDetector,
    VectorMath,
    ClientUpdate,
    NodeInfo,
    ComparisonResult,
    OutlierInfo,
    ClusterStats,
    logger as federated_logger
)

app = FastAPI(title="System Telemetry API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# if not SUPABASE_URL or not SUPABASE_KEY:
#     raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables are required")

# supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

wazuh = WazuhSDK(
    host="143.110.250.168",
    api_username="wazuh",
    api_password="XF59yHeRxf.CPK..G1yVHMhm6ZPeAtUA",
    indexer_username="admin",
    indexer_password="Peper-123900",
)

# Initialize Groq client for AI report generation
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Database connection URL
DATABASE_URL = os.getenv("DATABASE_URL")

# Initialize federated learning components
registry = NodeRegistry()
fedavg_engine = FedAvgEngine()
anomaly_detector = AnomalyDetector(registry)


# Pydantic models for request validation
class CPUMetrics(BaseModel):
    percent: float
    count: int
    count_logical: int
    frequency_mhz: Optional[float] = None

class MemoryMetrics(BaseModel):
    total_bytes: int
    available_bytes: int
    used_bytes: int
    percent: float
    swap_total_bytes: int
    swap_used_bytes: int
    swap_percent: float
    swap_in_bytes: Optional[int] = None
    swap_out_bytes: Optional[int] = None
    swap_in_bytes_per_sec: Optional[float] = None
    swap_out_bytes_per_sec: Optional[float] = None

class DiskPartition(BaseModel):
    device: str
    mountpoint: str
    fstype: str
    total_bytes: int
    used_bytes: int
    free_bytes: int
    percent: float

class DiskIO(BaseModel):
    read_bytes: int
    write_bytes: int
    read_count: int
    write_count: int
    read_bytes_per_sec: Optional[float] = None
    write_bytes_per_sec: Optional[float] = None

class DiskMetrics(BaseModel):
    partitions: list[DiskPartition]
    io: DiskIO

class NetworkMetrics(BaseModel):
    bytes_sent: int
    bytes_recv: int
    packets_sent: int
    packets_recv: int
    errors_in: int
    errors_out: int
    drops_in: int
    drops_out: int
    bytes_sent_per_sec: Optional[float] = None
    bytes_recv_per_sec: Optional[float] = None

class TelemetryPayload(BaseModel):
    timestamp: str
    hostname: str
    system: str
    system_id: str  # Unique identifier for the VPS
    cpu: CPUMetrics
    memory: MemoryMetrics
    disk: DiskMetrics
    network: NetworkMetrics


# =============================================================================
# TELEMETRY ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    return {"status": "ok", "service": "System Telemetry API"}


@app.get("/health")
async def health_check():
    import time
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "nodes_registered": len(registry.nodes),
        "nodes_active": len(registry.get_active_nodes())
    }


@app.post("/api/metrics")
async def receive_metrics(payload: TelemetryPayload):
    """
    Receive system metrics from client toolkit and store in Supabase.
    """
    try:
        telemetry_record = {
            "id": str(uuid.uuid4()),
            "created_at": datetime.utcnow().isoformat(),
            "system_id": payload.system_id,
            "hostname": payload.hostname,
            "system": payload.system,
            "cpu": payload.cpu.model_dump(),
            "memory": payload.memory.model_dump(),
            "disk": payload.disk.model_dump(),
            "network": payload.network.model_dump(),
        }
        
        result = supabase.table("system_telemetry").insert(telemetry_record).execute()
        print("Metrics stored successfully", result)
        
        return {
            "status": "success",
            "message": "Metrics stored successfully",
            "id": telemetry_record["id"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store metrics: {str(e)}")


# =============================================================================
# FEDERATED LEARNING ENDPOINTS
# =============================================================================

@app.post("/federated/update")
async def receive_federated_update(update: ClientUpdate):
    """
    Receive a federated update from a client.
    Returns aggregated weights if available.
    """
    import time
    try:
        # Register or update the node
        node = registry.register_or_update(update)
        
        federated_logger.info(
            f"Update from {update.client_id}: "
            f"samples={update.num_samples}, update_count={update.update_count}"
        )
        
        # Compute FedAvg if we have enough nodes
        all_weights = registry.get_all_weights(active_only=True)
        aggregated = fedavg_engine.compute_average(all_weights)
        
        # Compute outlier score for this node
        outlier_scores = anomaly_detector.compute_outlier_scores()
        node_outlier = outlier_scores.get(update.client_id)
        
        response = {
            "status": "ok",
            "timestamp": time.time(),
            "cluster_size": len(registry.get_active_nodes())
        }
        
        if aggregated:
            response["aggregated_weights"] = aggregated
        
        if node_outlier:
            response["outlier_score"] = node_outlier.outlier_score
            response["is_outlier"] = node_outlier.is_outlier
        
        return response
        
    except Exception as e:
        federated_logger.error(f"Error processing update: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/nodes", response_model=List[NodeInfo])
async def list_nodes():
    """List all registered nodes."""
    nodes = registry.get_all_nodes()
    outlier_scores = anomaly_detector.compute_outlier_scores()
    
    result = []
    for node in nodes:
        outlier_info = outlier_scores.get(node.client_id)
        result.append(NodeInfo(
            client_id=node.client_id,
            last_seen=node.last_seen,
            last_seen_human=datetime.fromtimestamp(node.last_seen).isoformat(),
            embedding=node.embedding,
            num_samples=node.num_samples,
            update_count=node.update_count,
            is_stale=node.is_stale(),
            outlier_score=outlier_info.outlier_score if outlier_info else None
        ))
    
    return result


@app.get("/nodes/{client_id}", response_model=NodeInfo)
async def get_node(client_id: str):
    """Get details for a specific node."""
    node = registry.get_node(client_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    outlier_scores = anomaly_detector.compute_outlier_scores()
    outlier_info = outlier_scores.get(client_id)
    
    return NodeInfo(
        client_id=node.client_id,
        last_seen=node.last_seen,
        last_seen_human=datetime.fromtimestamp(node.last_seen).isoformat(),
        embedding=node.embedding,
        num_samples=node.num_samples,
        update_count=node.update_count,
        is_stale=node.is_stale(),
        outlier_score=outlier_info.outlier_score if outlier_info else None
    )


@app.get("/nodes/{client_id}/history")
async def get_node_history(client_id: str):
    """Get embedding history for a node."""
    node = registry.get_node(client_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    return {
        "client_id": client_id,
        "history_length": len(node.embedding_history),
        "history": node.embedding_history
    }


@app.get("/compare/{id1}/{id2}", response_model=ComparisonResult)
async def compare_nodes(id1: str, id2: str):
    """Compare two nodes by their embeddings."""
    node1 = registry.get_node(id1)
    node2 = registry.get_node(id2)
    
    if not node1:
        raise HTTPException(status_code=404, detail=f"Node {id1} not found")
    if not node2:
        raise HTTPException(status_code=404, detail=f"Node {id2} not found")
    
    cosine_sim = VectorMath.cosine_similarity(node1.embedding, node2.embedding)
    cosine_dist = VectorMath.cosine_distance(node1.embedding, node2.embedding)
    euclidean_dist = VectorMath.euclidean_distance(node1.embedding, node2.embedding)
    
    # Interpret the similarity
    if cosine_sim > 0.95:
        interpretation = "Nearly identical behavior"
    elif cosine_sim > 0.8:
        interpretation = "Very similar behavior"
    elif cosine_sim > 0.5:
        interpretation = "Somewhat similar behavior"
    elif cosine_sim > 0.2:
        interpretation = "Different behavior"
    else:
        interpretation = "Very different behavior - investigate!"
    
    return ComparisonResult(
        node_a=id1,
        node_b=id2,
        cosine_similarity=cosine_sim,
        cosine_distance=cosine_dist,
        euclidean_distance=euclidean_dist,
        interpretation=interpretation
    )


@app.get("/outliers", response_model=List[OutlierInfo])
async def get_outliers():
    """Get list of nodes flagged as behavioral outliers."""
    return anomaly_detector.get_outliers()


@app.get("/cluster", response_model=ClusterStats)
async def get_cluster_stats():
    """Get overall cluster statistics."""
    all_nodes = registry.get_all_nodes()
    active_nodes = registry.get_active_nodes()
    embeddings = registry.get_all_embeddings(active_only=True)
    
    # Compute centroid
    centroid = VectorMath.centroid(embeddings) if embeddings else []
    
    # Compute average distance from centroid
    if centroid and embeddings:
        distances = [
            VectorMath.euclidean_distance(emb, centroid) 
            for emb in embeddings
        ]
        avg_distance = sum(distances) / len(distances)
    else:
        avg_distance = 0.0
    
    # Count outliers
    outliers = anomaly_detector.get_outliers()
    
    # Total samples across all nodes
    total_samples = sum(n.num_samples for n in active_nodes)
    
    return ClusterStats(
        total_nodes=len(all_nodes),
        active_nodes=len(active_nodes),
        stale_nodes=len(all_nodes) - len(active_nodes),
        total_samples=total_samples,
        centroid=centroid,
        avg_distance_from_centroid=avg_distance,
        outlier_count=len(outliers)
    )

@app.get("/get/vulnerabilities")
async def get_vulnerabilities():
    vulnerabilities = wazuh.get_all_vulnerabilities(severity_filter=["Critical", "High", "Medium", "Low"])
    return vulnerabilities


# =============================================================================
# REPORT GENERATION ENDPOINT
# =============================================================================

class ReportRequest(BaseModel):
    user_id: str


def get_business_context(user_id: str) -> dict:
    """Fetch business context from PostgreSQL database."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, user_id, name, description, industry, services, 
                   contact_email, phone, address, social_links, created_at, updated_at
            FROM business_context 
            WHERE user_id = %s 
            LIMIT 1
            """,
            (user_id,)
        )
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if row:
            return {
                "id": row[0],
                "user_id": row[1],
                "name": row[2],
                "description": row[3],
                "industry": row[4],
                "services": row[5],
                "contact_email": row[6],
                "phone": row[7],
                "address": row[8],
                "social_links": row[9],
                "created_at": str(row[10]) if row[10] else None,
                "updated_at": str(row[11]) if row[11] else None,
            }
        return None
    except Exception as e:
        print(f"Error fetching business context: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def generate_ai_report(business_context: dict, vulnerabilities: list) -> str:
    """Generate a vulnerability impact report using Groq AI."""
    
    # Prepare vulnerability summary
    vuln_summary = []
    severity_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    
    for vuln in vulnerabilities[:50]:  # Limit to top 50 for context window
        severity = vuln.get("severity", "Unknown")
        if severity in severity_counts:
            severity_counts[severity] += 1
        vuln_summary.append({
            "cve_id": vuln.get("cve_id", "N/A"),
            "severity": severity,
            "package": vuln.get("package_name", "N/A"),
            "description": vuln.get("description", "N/A")[:200],  # Truncate descriptions
        })
    
    prompt = f"""You are a cybersecurity analyst. Generate a comprehensive vulnerability impact report for the following business.

## Business Information:
- Company Name: {business_context.get('name', 'Unknown')}
- Industry: {business_context.get('industry', 'Unknown')}
- Description: {business_context.get('description', 'N/A')}
- Services: {business_context.get('services', 'N/A')}

## Vulnerability Summary:
- Total Vulnerabilities: {len(vulnerabilities)}
- Critical: {severity_counts['Critical']}
- High: {severity_counts['High']}
- Medium: {severity_counts['Medium']}
- Low: {severity_counts['Low']}

## Top Vulnerabilities:
{vuln_summary[:20]}

Please generate a professional report with the following sections:
1. Executive Summary - Brief overview of the security posture
2. Risk Assessment - Analysis of how these vulnerabilities could impact the business given their industry
3. Critical Findings - Details on the most severe vulnerabilities
4. Business Impact Analysis - How these vulnerabilities could affect business operations
5. Recommendations - Priority actions to remediate the vulnerabilities
6. Conclusion

Make the report professional, concise, and actionable. Focus on business impact relevant to the {business_context.get('industry', 'Unknown')} industry."""

    chat_completion = groq_client.chat.completions.create(
        messages=[
            {
                "role": "system",
                "content": "You are a professional cybersecurity analyst specializing in vulnerability assessment and risk management."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        model="llama-3.3-70b-versatile",
        temperature=0.7,
        max_tokens=4096,
    )
    
    return chat_completion.choices[0].message.content


def create_pdf_report(report_content: str, business_context: dict, vulnerabilities: list) -> bytes:
    """Create a PDF document from the report content."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='ReportTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        textColor=colors.HexColor('#1a1a2e'),
        alignment=1  # Center
    ))
    styles.add(ParagraphStyle(
        name='SectionHead',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#16213e'),
    ))
    styles.add(ParagraphStyle(
        name='ReportBody',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=12,
        leading=14,
    ))
    
    story = []
    
    # Title
    company_name = business_context.get('name', 'Unknown Company')
    story.append(Paragraph(f"Vulnerability Impact Report", styles['ReportTitle']))
    story.append(Paragraph(f"<b>{company_name}</b>", styles['ReportBody']))
    story.append(Spacer(1, 12))
    
    # Date and summary info
    report_date = datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")
    story.append(Paragraph(f"<b>Generated:</b> {report_date}", styles['ReportBody']))
    story.append(Paragraph(f"<b>Industry:</b> {business_context.get('industry', 'N/A')}", styles['ReportBody']))
    story.append(Paragraph(f"<b>Total Vulnerabilities:</b> {len(vulnerabilities)}", styles['ReportBody']))
    story.append(Spacer(1, 20))
    
    # Severity summary table
    severity_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    for vuln in vulnerabilities:
        severity = vuln.get("severity", "Unknown")
        if severity in severity_counts:
            severity_counts[severity] += 1
    
    table_data = [
        ["Severity", "Count"],
        ["Critical", str(severity_counts["Critical"])],
        ["High", str(severity_counts["High"])],
        ["Medium", str(severity_counts["Medium"])],
        ["Low", str(severity_counts["Low"])],
    ]
    
    table = Table(table_data, colWidths=[2*inch, 1.5*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#ff4757')),  # Critical - red
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#ff7f50')),  # High - orange
        ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#ffa502')),  # Medium - yellow
        ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#2ed573')),  # Low - green
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 11),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ]))
    story.append(table)
    story.append(Spacer(1, 30))
    
    # AI Report content
    story.append(Paragraph("AI-Generated Analysis", styles['SectionHead']))
    story.append(Spacer(1, 10))
    
    # Process the report content - split by lines and add as paragraphs
    for line in report_content.split('\n'):
        if line.strip():
            # Handle markdown headers
            if line.startswith('# '):
                story.append(Paragraph(line[2:], styles['SectionHead']))
            elif line.startswith('## '):
                story.append(Paragraph(line[3:], styles['SectionHead']))
            elif line.startswith('### '):
                story.append(Paragraph(f"<b>{line[4:]}</b>", styles['ReportBody']))
            elif line.startswith('- '):
                story.append(Paragraph(f"• {line[2:]}", styles['ReportBody']))
            elif line.startswith('* '):
                story.append(Paragraph(f"• {line[2:]}", styles['ReportBody']))
            else:
                # Clean up any remaining markdown
                clean_line = line.replace('**', '').replace('*', '')
                story.append(Paragraph(clean_line, styles['ReportBody']))
    
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes


@app.post("/generate/report")
async def generate_report(request: ReportRequest):
    """
    Generate a vulnerability impact report for a business.
    
    Takes a user_id, fetches their business context, gets current vulnerabilities,
    generates an AI-powered report, creates a PDF, and uploads to R2 storage.
    
    Returns the public URL of the generated PDF.
    """
    try:
        # 1. Fetch business context from database
        business_context = get_business_context(request.user_id)
        if not business_context:
            raise HTTPException(status_code=404, detail="Business context not found for this user")
        
        # 2. Get current vulnerabilities from Wazuh
        vulnerabilities = wazuh.get_all_vulnerabilities(severity_filter=["Critical", "High", "Medium", "Low"])
        
        # 3. Generate AI report using Groq
        report_content = generate_ai_report(business_context, vulnerabilities)
        
        # 4. Create PDF
        pdf_bytes = create_pdf_report(report_content, business_context, vulnerabilities)
        
        # 5. Upload to R2
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        company_name = business_context.get('name', 'unknown').replace(' ', '_').lower()
        file_key = f"reports/{company_name}_{timestamp}_{uuid.uuid4().hex[:8]}.pdf"
        
        s3.upload_object(pdf_bytes, file_key)
        
        # 6. Get public URL
        public_url = s3.get_object_url(file_key)
        
        return {
            "status": "success",
            "message": "Report generated successfully",
            "report_url": public_url,
            "generated_at": datetime.utcnow().isoformat(),
            "vulnerability_count": len(vulnerabilities),
            "company_name": business_context.get('name', 'Unknown')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

