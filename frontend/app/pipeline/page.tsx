"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, StackInfo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    Loader2,
    Cpu,
    FileCode,
    Container,
    Play,
    ArrowDown,
    CheckCircle2,
    Box,
    Download,
    Share2
} from "lucide-react";
import Link from "next/link";

interface SortableItemProps {
    id: string;
}

function SortableItem({ id }: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const getIcon = (stepId: string) => {
        if (stepId.includes("checkout")) return <Download className="size-5 text-blue-500" />;
        if (stepId.includes("install")) return <Box className="size-5 text-yellow-500" />;
        if (stepId.includes("test")) return <CheckCircle2 className="size-5 text-green-500" />;
        if (stepId.includes("docker")) return <Container className="size-5 text-cyan-500" />;
        if (stepId.includes("push")) return <Share2 className="size-5 text-purple-500" />;
        return <Play className="size-5 text-primary" />;
    };

    const getLabel = (stepId: string) => {
        const map: Record<string, string> = {
            "checkout": "Checkout Code",
            "install_deps": "Install Dependencies",
            "run_tests": "Run Tests",
            "docker_build": "Build Docker Image",
            "push_image": "Push to Registry"
        };
        return map[stepId] || stepId;
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none mb-3">
            <Card className="cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2 rounded-md bg-secondary flex-shrink-0">
                        {getIcon(id)}
                    </div>
                    <div className="flex-1 font-medium">
                        {getLabel(id)}
                    </div>
                    <div className="text-muted-foreground">
                        <div className="size-6 flex items-center justify-center opacity-50">:::</div>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}

import { DeploymentModal } from "@/components/deployment-modal";
import { generateCDPipeline } from "@/lib/api";
import { Cloud, Check } from "lucide-react";

export default function PipelinePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [stack, setStack] = useState<StackInfo | null>(null);
    const [steps, setSteps] = useState<string[]>([]);

    // Deployment states
    const [isConfigured, setIsConfigured] = useState(false);
    const [cdGenerating, setCdGenerating] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchSuggestions();
    }, []);

    const fetchSuggestions = async () => {
        try {
            const { data } = await api.post("/pipeline/suggest");
            setStack(data.stack);
            setSteps(data.suggested_steps);
        } catch (err) {
            console.error(err);
            // alert("Error fetching suggestions. Make sure repo is selected.");
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setSteps((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const { data } = await api.post("/pipeline/generate-and-commit", { steps });
            const query = new URLSearchParams({
                path: data.file_path,
                commit: data.commit,
                yaml: data.yaml_preview
            }).toString();

            router.push(`/commit?${query}`);
        } catch (err) {
            console.error(err);
            alert("Failed to commit pipeline.");
            setGenerating(false);
        }
    };

    const handleGenerateCD = async () => {
        setCdGenerating(true);
        try {
            const { data } = await generateCDPipeline();
            const query = new URLSearchParams({
                path: data.file_path,
                commit: data.commit,
                yaml: data.yaml_preview
            }).toString();

            router.push(`/commit?${query}`);
        } catch (err) {
            console.error(err);
            alert("Failed to commit CD pipeline.");
            setCdGenerating(false);
        }
    };

    if (loading) {
        return <PipelineSkeleton />;
    }

    // Hack: Assuming repo info is not deeply needed for modal display only,
    // or we fetch it from backend context endpoint if we made one.
    // For now, passing placeholders or simple check.
    // Ideally we fetch current repo info.
    const owner = "";
    const repo = "";

    return (
        <div className="min-h-screen p-8 max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
            {/* Left Sidebar: Stack Info */}
            <div className="lg:w-1/3 space-y-6">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h1 className="text-3xl font-bold tracking-tight">Configure Pipeline</h1>

                    </div>
                    <p className="text-muted-foreground">Review and order your workflow steps.</p>
                </div>

                <div className="space-y-4">
                    {/* Deployment Section */}
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader className="py-4">
                            <CardTitle className="text-base flex items-center justify-between">
                                <span className="flex items-center gap-2"><Cloud className="size-4" /> Deployment</span>
                                {isConfigured && <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-[10px]"><Check className="size-3 mr-1" /> Configured</Badge>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isConfigured ? (
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Target: AKS</p>
                                    <Button size="sm" className="w-full" onClick={handleGenerateCD} disabled={cdGenerating}>
                                        {cdGenerating ? (
                                            <>
                                                <Loader2 className="mr-2 size-4 animate-spin" />
                                                Generating CD...
                                            </>
                                        ) : (
                                            "Generate CD Pipeline"
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Add deployment target to enable CD pipeline generation.</p>
                                    <DeploymentModal
                                        onConfigured={() => setIsConfigured(true)}
                                        owner={owner}
                                        repo={repo}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Cpu className="size-5 text-primary" />
                                Stack Analysis
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground flex items-center gap-2">
                                    <FileCode className="size-4" /> Language
                                </span>
                                <Badge variant="outline" className="uppercase">{stack?.language}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Box className="size-4" /> Framework
                                </span>
                                <Badge variant="outline" className="uppercase">{stack?.framework}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Container className="size-4" /> Docker
                                </span>
                                <Badge variant={stack?.has_dockerfile ? "default" : "secondary"}>
                                    {stack?.has_dockerfile ? "Detected" : "None"}
                                </Badge>
                            </div>
                        </CardContent>

                    </Card>
                </div>

                {stack?.detected_files && stack.detected_files.length > 0 && (
                    <Card>
                        <CardHeader className="py-4"><CardTitle className="text-sm">Detected Files</CardTitle></CardHeader>
                        <CardContent className="text-xs text-muted-foreground space-y-1">
                            {stack.detected_files.slice(0, 5).map(f => <div key={f}>{f}</div>)}
                            {stack.detected_files.length > 5 && <div>+ {stack.detected_files.length - 5} more</div>}
                        </CardContent>
                    </Card>
                )}

                <Link href="/automation">
                    <Button variant="destructive" size="default">
                        Automation
                    </Button>
                </Link>
            </div>

            {/* Right Content: Builder */}
            <div className="lg:w-2/3 space-y-6">
                <Card className="bg-muted/30 border-dashed border-2 min-h-[500px] flex flex-col">
                    <CardHeader>
                        <CardTitle>Pipeline Steps</CardTitle>
                        <CardDescription>Drag the items below to reorder execution flow.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={steps}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-4 relative">
                                    {steps.length > 0 ? (
                                        steps.map((step, index) => (
                                            <div key={step}>
                                                <SortableItem id={step} />
                                                {index < steps.length - 1 && (
                                                    <div className="flex justify-center py-1">
                                                        <ArrowDown className="size-4 text-muted-foreground/30" />
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-20 text-muted-foreground">
                                            No steps suggested.
                                        </div>
                                    )}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                    <Button variant="outline" disabled={generating}>
                        Reset
                    </Button>
                    <Button size="lg" onClick={handleGenerate} disabled={generating || steps.length === 0}>
                        {generating ? (
                            <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Generating & Committing...
                            </>
                        ) : (
                            "Generate Workflow"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function PipelineSkeleton() {
    return (
        <div className="min-h-screen p-8 max-w-6xl mx-auto flex gap-8">
            <div className="w-1/3 space-y-4">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-40 w-full" />
            </div>
            <div className="w-2/3 space-y-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-[500px] w-full" />
            </div>
        </div>
    )
}
