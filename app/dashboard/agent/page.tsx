"use client";

import React, { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

function Agent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "agent",
      content: "Hello! I'm your AI System Agent. I can help you with information about your system's current state, node analytics, cluster health, and more. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const generateAgentResponse = async (userMessage: string): Promise<string> => {
    // Simulate AI response - Replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes("status") || lowerMessage.includes("health")) {
      return "🟢 **System Status: Healthy**\n\n• All nodes are operational\n• Cluster uptime: 99.9%\n• Active connections: 24\n• Last sync: 2 minutes ago\n\nWould you like more details about any specific component?";
    }

    if (lowerMessage.includes("node") || lowerMessage.includes("nodes")) {
      return "📊 **Node Overview**\n\n• Total Nodes: 24\n• Active: 21\n• Stale: 3\n• Total Samples: 2.5M+\n• Average Outlier Score: 0.45\n\nI can provide detailed information about any specific node. Just ask!";
    }

    if (lowerMessage.includes("cluster")) {
      return "🔗 **Cluster Analytics**\n\n• Cluster ID: main-cluster\n• Centroid Stability: 98.2%\n• Avg Distance from Centroid: 0.23\n• Outlier Count: 2\n• Last Updated: Just now\n\nThe cluster is performing within optimal parameters.";
    }

    if (lowerMessage.includes("anomaly") || lowerMessage.includes("anomalies")) {
      return "⚠️ **Anomaly Detection Report**\n\n• Detected Anomalies: 3\n• High Severity: 0\n• Medium Severity: 1\n• Low Severity: 2\n\nMost recent anomaly detected on Node-007 (drift pattern). Would you like me to analyze it further?";
    }

    if (lowerMessage.includes("report") || lowerMessage.includes("reports")) {
      return "📄 **Available Reports**\n\n• Monthly Analytics Report (PDF)\n• Node Performance Data (CSV)\n• Cluster Analysis Export (JSON)\n• Weekly Summary Report (PDF)\n\nYou can access these from the Reports section or I can summarize any of them for you.";
    }

    if (lowerMessage.includes("help")) {
      return "🤖 **I can help you with:**\n\n• System status and health checks\n• Node information and analytics\n• Cluster performance metrics\n• Anomaly detection insights\n• Report summaries\n• Troubleshooting guidance\n\nJust ask me anything about your system!";
    }

    return "I understand you're asking about: \"" + userMessage + "\"\n\nI can provide information about system status, nodes, clusters, anomalies, and reports. Could you please be more specific about what you'd like to know?";
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Add typing indicator
    const typingMessage: Message = {
      id: "typing",
      role: "agent",
      content: "",
      timestamp: new Date(),
      isTyping: true,
    };
    setMessages((prev) => [...prev, typingMessage]);

    try {
      const response = await generateAgentResponse(userMessage.content);

      // Remove typing indicator and add actual response
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== "typing");
        return [
          ...filtered,
          {
            id: `agent-${Date.now()}`,
            role: "agent",
            content: response,
            timestamp: new Date(),
          },
        ];
      });
    } catch (error) {
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== "typing");
        return [
          ...filtered,
          {
            id: `agent-${Date.now()}`,
            role: "agent",
            content: "I apologize, but I encountered an error processing your request. Please try again.",
            timestamp: new Date(),
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "What's the system status?",
    "Show me node overview",
    "Any anomalies detected?",
    "Cluster health check",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-bl from-black via-green-950/80 to-black text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-green-800/50 bg-black/40 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-black animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-emerald-400">System Agent</h1>
              <p className="text-sm text-gray-400">AI-powered system assistant</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] ${
                    message.role === "user"
                      ? "order-1"
                      : "order-2"
                  }`}
                >
                  {message.role === "agent" && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center">
                        <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                        </svg>
                      </div>
                      <span className="text-xs text-gray-500">Agent</span>
                    </div>
                  )}
                  
                  <div
                    className={`rounded-2xl px-5 py-3 ${
                      message.role === "user"
                        ? "bg-emerald-600 text-white rounded-br-md"
                        : "bg-green-900/50 border border-green-700/50 text-white rounded-bl-md"
                    }`}
                  >
                    {message.isTyping ? (
                      <div className="flex items-center gap-2 py-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                        </div>
                        <span className="text-sm text-gray-400">Thinking...</span>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content.split("\n").map((line, i) => (
                          <React.Fragment key={i}>
                            {line.startsWith("•") ? (
                              <div className="flex items-start gap-2 my-1">
                                <span className="text-emerald-400">•</span>
                                <span>{line.slice(1).trim()}</span>
                              </div>
                            ) : line.startsWith("**") && line.endsWith("**") ? (
                              <div className="font-semibold text-emerald-400 my-2">
                                {line.slice(2, -2)}
                              </div>
                            ) : (
                              <>{line}<br /></>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div
                    className={`text-xs text-gray-500 mt-1 ${
                      message.role === "user" ? "text-right" : "text-left"
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {messages.length <= 2 && (
            <div className="px-6 pb-4">
              <p className="text-xs text-gray-500 mb-3">Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => setInputValue(question)}
                    className="px-4 py-2 text-sm rounded-full bg-green-900/30 border border-green-700/50 text-emerald-400 hover:bg-green-800/50 hover:border-emerald-500/50 transition-all duration-300"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-green-800/50 bg-black/60 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me about your system..."
                rows={1}
                className="w-full px-5 py-4 rounded-2xl bg-green-900/30 border border-green-700/50 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:bg-green-900/50 transition-all duration-300 resize-none"
                style={{ minHeight: "56px", maxHeight: "150px" }}
                disabled={isLoading}
              />
              <div className="absolute right-3 bottom-3 text-xs text-gray-500">
                Press Enter to send
              </div>
            </div>
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className={`p-4 rounded-2xl transition-all duration-300 flex items-center justify-center ${
                inputValue.trim() && !isLoading
                  ? "bg-emerald-500 hover:bg-emerald-400 text-black"
                  : "bg-green-900/30 text-gray-500 cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-gray-500 border-t-emerald-400 rounded-full animate-spin"></div>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span>Agent is online</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-gray-500 hover:text-emerald-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <button className="text-gray-500 hover:text-emerald-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Agent;
