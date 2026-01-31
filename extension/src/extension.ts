import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { analyzeFindingsFile, getFixForFinding, ZeroHourResult } from '../../src/api';
import { AnalysisResult, EnrichedFinding } from '../../src/types';

let outputChannel: vscode.OutputChannel;
let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    console.log('ZeroHour for Trae AI is now active!');

    // Load environment variables (GROQ_API_KEY) from .env in workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        const rootPath = workspaceFolders[0].uri.fsPath;
        const envPath = path.join(rootPath, '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf-8');
            envContent.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    process.env[key.trim()] = value.trim();
                }
            });
        }
    }

    outputChannel = vscode.window.createOutputChannel("ZeroHour (Trae Edition)");
    diagnosticCollection = vscode.languages.createDiagnosticCollection('zerohour-trae');
    context.subscriptions.push(outputChannel, diagnosticCollection);

    // Register Code Action Provider
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { scheme: 'file', language: '*' },
            new ZeroHourFixProvider(),
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
        )
    );

    // Register Fix Command
    context.subscriptions.push(
        vscode.commands.registerCommand('zerohour.fixFinding', async (document: vscode.TextDocument, range: vscode.Range, finding: EnrichedFinding) => {
            await applyAiFix(document, range, finding);
        })
    );

    let disposable = vscode.commands.registerCommand('zerohour.analyze', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Trae AI: Please open a folder first.');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const findingsPath = path.join(rootPath, 'findings.json');

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "ZeroHour: Scanning for Trae...",
            cancellable: false
        }, async (progress) => {
            try {
                outputChannel.clear();
                outputChannel.show();
                diagnosticCollection.clear();
                outputChannel.appendLine(`Starting Trae AI security analysis for: ${rootPath}`);

                const result = await analyzeFindingsFile(findingsPath, (msg) => {
                    progress.report({ message: msg });
                    outputChannel.appendLine(`[TRAE-STATUS] ${msg}`);
                });

                // Populate Diagnostics
                updateDiagnostics(result);

                // Display Results in Output Channel
                outputChannel.appendLine('\n--- TRAE ANALYSIS COMPLETE ---\n');
                
                if (result.topRisks.length === 0 && result.allFindings.length === 0) {
                    vscode.window.showInformationMessage('✅ ZeroHour for Trae: No risks found!');
                    outputChannel.appendLine('No findings to report.');
                } else {
                    vscode.window.showWarningMessage(`⚠️ ZeroHour for Trae: Found ${result.topRisks.length} critical risks.`);
                    
                    outputChannel.appendLine('=== TOP CRITICAL RISKS (TRAE AI PRIORITY) ===');
                    result.topRisks.forEach((risk, index) => {
                        outputChannel.appendLine(`\n${index + 1}. [${risk.confidence}] ${risk.title}`);
                        outputChannel.appendLine(`   File: ${risk.originalFinding.file}:${risk.originalFinding.line}`);
                        outputChannel.appendLine(`   Impact: ${risk.impact}`);
                        outputChannel.appendLine(`   Fix: ${risk.fix}`);
                    });

                    outputChannel.appendLine('\n=== ALL FINDINGS ===');
                    result.allFindings.forEach((f, i) => {
                        outputChannel.appendLine(`${i + 1}. [${f.severity}] ${f.message} (${f.file}:${f.line})`);
                    });
                }

            } catch (error: any) {
                vscode.window.showErrorMessage(`Trae Analysis failed: ${error.message}`);
                outputChannel.appendLine(`[ERROR] ${error.message}`);
            }
        });
    });

    context.subscriptions.push(disposable);
}

function updateDiagnostics(result: ZeroHourResult) {
    diagnosticCollection.clear();
    const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();

    const addToMap = (finding: EnrichedFinding) => {
        const fileUri = vscode.Uri.file(path.resolve(vscode.workspace.workspaceFolders![0].uri.fsPath, finding.file));
        
        // Line numbers are 1-based in finding, 0-based in VS Code
        const range = new vscode.Range(
            Math.max(0, finding.line - 1), 
            0, 
            Math.max(0, (finding.endLine || finding.line) - 1), 
            Number.MAX_VALUE
        );

        const diagnostic = new vscode.Diagnostic(
            range,
            `[ZeroHour] ${finding.message}`,
            finding.severity === 'ERROR' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
        );
        diagnostic.source = 'ZeroHour';
        diagnostic.code = { value: finding.ruleId, target: vscode.Uri.parse('https://semgrep.dev/r/' + finding.ruleId) }; // Arbitrary link
        
        // Attach finding data to diagnostic for the code action
        // We can't attach arbitrary data to Diagnostic, but we can look it up later or use a custom subclass?
        // Actually, CodeActionProvider is passed the diagnostics. We can try to match them back or parse the message.
        // Better: We'll match by file and range in the provider.
        
        const existing = diagnosticsMap.get(fileUri.toString()) || [];
        existing.push(diagnostic);
        diagnosticsMap.set(fileUri.toString(), existing);
    };

    result.allFindings.forEach(addToMap);

    diagnosticsMap.forEach((diags, uriString) => {
        diagnosticCollection.set(vscode.Uri.parse(uriString), diags);
    });
}

class ZeroHourFixProvider implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source === 'ZeroHour') {
                // Create a fix action
                const action = new vscode.CodeAction('Fix with ZeroHour AI', vscode.CodeActionKind.QuickFix);
                action.diagnostics = [diagnostic];
                
                // We need to reconstruct the Finding object to pass to the command
                // This is a bit tricky. We should store findings globally or look them up.
                // For now, let's assume we can reconstruct enough info or finding the file is enough.
                // Actually, getFixForFinding needs: file, line, endLine, message, codeSnippet.
                
                const finding: EnrichedFinding = {
                    ruleId: typeof diagnostic.code === 'object' ? String(diagnostic.code.value) : String(diagnostic.code),
                    file: vscode.workspace.asRelativePath(document.uri),
                    line: diagnostic.range.start.line + 1,
                    endLine: diagnostic.range.end.line + 1,
                    message: diagnostic.message.replace('[ZeroHour] ', ''),
                    severity: diagnostic.severity === vscode.DiagnosticSeverity.Error ? 'ERROR' : 'WARNING',
                    codeSnippet: document.getText(diagnostic.range), // Approximate snippet
                    // Mocked fields for AI context (not critical for fix generation)
                    context: {
                        isPayment: false,
                        isAdmin: false,
                        isAuth: false,
                        isPublicFacing: false,
                        modifiesDatabase: false
                    },
                    exposureScore: 0
                };

                action.command = {
                    command: 'zerohour.fixFinding',
                    title: 'Fix with ZeroHour AI',
                    arguments: [document, diagnostic.range, finding]
                };
                
                actions.push(action);
            }
        }

        return actions;
    }
}

async function applyAiFix(document: vscode.TextDocument, range: vscode.Range, finding: EnrichedFinding) {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating AI Fix...",
        cancellable: false
    }, async () => {
        try {
            const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            const fixResult = await getFixForFinding(finding, rootPath);
            
            if (!fixResult || !fixResult.replacementCode) {
                vscode.window.showErrorMessage('AI could not generate a fix.');
                return;
            }

            const edit = new vscode.WorkspaceEdit();
            
            // 1. Replace Code
            // The range provided by diagnostic might be single line or multi-line.
            // fixResult.replacementCode is the new code.
            edit.replace(document.uri, range, fixResult.replacementCode);

            // 2. Add Imports (if any)
            if (fixResult.imports && fixResult.imports.length > 0) {
                const docText = document.getText();
                const importsToAdd = fixResult.imports.filter(imp => !docText.includes(imp));
                
                if (importsToAdd.length > 0) {
                    // Insert at top (simplified)
                    // In a real extension, we'd find the last import.
                    edit.insert(document.uri, new vscode.Position(0, 0), importsToAdd.join('\n') + '\n');
                }
            }

            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                vscode.window.showInformationMessage('✅ Fix applied! ' + (fixResult.explanation ? fixResult.explanation : ''));
            } else {
                vscode.window.showErrorMessage('Failed to apply edit.');
            }

        } catch (error: any) {
            vscode.window.showErrorMessage(`AI Fix failed: ${error.message}`);
        }
    });
}

export function deactivate() {}
