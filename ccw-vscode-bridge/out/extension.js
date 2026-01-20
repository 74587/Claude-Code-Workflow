"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
const PORT = 3457; // Port for the bridge server
function activate(context) {
    const server = http.createServer(async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            return res.end();
        }
        if (req.method !== 'POST' || !req.url) {
            res.writeHead(405);
            return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        }
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                const { file_path, line, character } = payload;
                const uri = vscode.Uri.file(file_path);
                let result;
                switch (req.url) {
                    case '/get_definition': {
                        if (line === undefined || character === undefined) {
                            res.writeHead(400);
                            return res.end(JSON.stringify({ error: 'line and character are required' }));
                        }
                        const position = new vscode.Position(line - 1, character - 1); // VSCode API is 0-based
                        result = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', uri, position);
                        break;
                    }
                    case '/get_references': {
                        if (line === undefined || character === undefined) {
                            res.writeHead(400);
                            return res.end(JSON.stringify({ error: 'line and character are required' }));
                        }
                        const position = new vscode.Position(line - 1, character - 1);
                        result = await vscode.commands.executeCommand('vscode.executeReferenceProvider', uri, position);
                        break;
                    }
                    case '/get_hover': {
                        if (line === undefined || character === undefined) {
                            res.writeHead(400);
                            return res.end(JSON.stringify({ error: 'line and character are required' }));
                        }
                        const position = new vscode.Position(line - 1, character - 1);
                        const hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', uri, position);
                        // Convert hover markdown to plain text for easier consumption
                        result = hovers?.map(hover => ({
                            contents: hover.contents.map(content => {
                                if (typeof content === 'string') {
                                    return content;
                                }
                                else if (content instanceof vscode.MarkdownString) {
                                    return content.value;
                                }
                                else {
                                    return content.value;
                                }
                            }),
                            range: hover.range ? {
                                start: { line: hover.range.start.line, character: hover.range.start.character },
                                end: { line: hover.range.end.line, character: hover.range.end.character }
                            } : undefined
                        }));
                        break;
                    }
                    case '/get_document_symbols': {
                        const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri);
                        // Flatten the symbol tree for easier consumption
                        const flattenSymbols = (symbols, parent) => {
                            return symbols.flatMap(symbol => {
                                const current = {
                                    name: symbol.name,
                                    kind: vscode.SymbolKind[symbol.kind],
                                    range: {
                                        start: { line: symbol.range.start.line, character: symbol.range.start.character },
                                        end: { line: symbol.range.end.line, character: symbol.range.end.character }
                                    },
                                    selectionRange: {
                                        start: { line: symbol.selectionRange.start.line, character: symbol.selectionRange.start.character },
                                        end: { line: symbol.selectionRange.end.line, character: symbol.selectionRange.end.character }
                                    },
                                    detail: symbol.detail,
                                    parent
                                };
                                return [current, ...flattenSymbols(symbol.children || [], symbol.name)];
                            });
                        };
                        result = symbols ? flattenSymbols(symbols) : [];
                        break;
                    }
                    default:
                        res.writeHead(404);
                        return res.end(JSON.stringify({ error: 'Not Found' }));
                }
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, result }));
            }
            catch (error) {
                console.error('CCW VSCode Bridge error:', error);
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                }));
            }
        });
    });
    server.listen(PORT, '127.0.0.1', () => {
        console.log(`CCW VSCode Bridge listening on http://127.0.0.1:${PORT}`);
        vscode.window.showInformationMessage(`CCW VSCode Bridge is active on port ${PORT}`);
    });
    context.subscriptions.push({
        dispose: () => {
            server.close();
            console.log('CCW VSCode Bridge server closed');
        }
    });
}
function deactivate() {
    console.log('CCW VSCode Bridge deactivated');
}
//# sourceMappingURL=extension.js.map