"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Globe, Sparkles, RefreshCw, CheckCircle } from "lucide-react";
import { trpc } from "@/trpc/client";
import { toast } from "sonner";

interface WebsiteInfo {
  name: string;
  description: string;
  industry: string;
  services: string;
  contactEmail: string;
  phone: string;
  address: string;
  socialLinks: string;
}

export default function ContextPage() {
  const [url, setUrl] = useState("");
  const [websiteInfo, setWebsiteInfo] = useState<WebsiteInfo>({
    name: "",
    description: "",
    industry: "",
    services: "",
    contactEmail: "",
    phone: "",
    address: "",
    socialLinks: "",
  });

  const analyzeMutation = trpc.website.analyze.useMutation({
    onSuccess: (data) => {
      setWebsiteInfo(data);
      toast.success("Website analyzed successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to analyze website");
    },
  });

  const saveContextMutation = trpc.website.saveContext.useMutation({
    onSuccess: () => {
      toast.success("Context saved successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save context");
    },
  });

  const analyzeWebsite = () => {
    if (!url) return;
    analyzeMutation.mutate({ url });
  };

  const handleInputChange = (field: keyof WebsiteInfo, value: string) => {
    setWebsiteInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    saveContextMutation.mutate({ url, ...websiteInfo });
  };

  const isAnalyzing = analyzeMutation.isPending;
  const isSaving = saveContextMutation.isPending;

  return (
    <div className="min-h-screen bg-linear-to-br from-black via-green-950/80 to-black p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/20 border border-green-500/30 shadow-lg shadow-green-500/10">
              <Globe className="h-5 w-5 text-green-400" />
            </span>
            <span><span className="text-green-400">Context</span> Creation</span>
          </h1>
          <p className="text-gray-400 ml-13">
            Enter a website URL to automatically extract business or portfolio information using AI.
          </p>
        </div>

        <Card className="mb-6 bg-black/50 backdrop-blur-sm border-green-500/20 shadow-lg shadow-green-500/5">
          <CardHeader className="border-b border-green-500/10">
            <CardTitle className="flex items-center gap-2 text-white">
              <Globe className="h-5 w-5 text-green-400" />
              Website URL
            </CardTitle>
            <CardDescription className="text-gray-400">
              Enter the website URL you want to analyze
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-black/60 border-green-500/30 text-white placeholder:text-gray-500 focus:border-green-400 focus:ring-green-400/20"
                disabled={isAnalyzing}
              />
              <Button 
                onClick={analyzeWebsite} 
                disabled={isAnalyzing || !url}
                className="bg-green-600 hover:bg-green-500 text-white border-0 shadow-lg shadow-green-500/20 transition-all duration-200 hover:shadow-green-500/40"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze with AI
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/80 backdrop-blur-sm border-green-500/20 shadow-lg shadow-green-500/5">
          <CardHeader className="border-b border-green-500/10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Extracted <span className="text-green-400">Information</span></CardTitle>
                <CardDescription className="text-gray-400">
                  Review and edit the automatically extracted information
                </CardDescription>
              </div>
              {websiteInfo.name && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={analyzeWebsite} 
                  disabled={isAnalyzing}
                  className="border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300 hover:border-green-400"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isAnalyzing ? "animate-spin" : ""}`} />
                  Re-analyze
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white font-medium">
                Business/Portfolio Name
              </Label>
              <Input
                id="name"
                placeholder="Enter business or portfolio name"
                value={websiteInfo.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                disabled={isAnalyzing}
                className="bg-black/60 border-green-500/30 text-white placeholder:text-gray-500 focus:border-green-400 focus:ring-green-400/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-white font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Brief description of the business or portfolio"
                value={websiteInfo.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={4}
                disabled={isAnalyzing}
                className="bg-black/60 border-green-500/30 text-white placeholder:text-gray-500 focus:border-green-400 focus:ring-green-400/20 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry" className="text-white font-medium">
                Industry/Category
              </Label>
              <Input
                id="industry"
                placeholder="e.g., Technology, Healthcare, Design"
                value={websiteInfo.industry}
                onChange={(e) => handleInputChange("industry", e.target.value)}
                disabled={isAnalyzing}
                className="bg-black/60 border-green-500/30 text-white placeholder:text-gray-500 focus:border-green-400 focus:ring-green-400/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="services" className="text-white font-medium">
                Services/Products
              </Label>
              <Textarea
                id="services"
                placeholder="List of services or products offered"
                value={websiteInfo.services}
                onChange={(e) => handleInputChange("services", e.target.value)}
                rows={3}
                disabled={isAnalyzing}
                className="bg-black/60 border-green-500/30 text-white placeholder:text-gray-500 focus:border-green-400 focus:ring-green-400/20 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="text-white font-medium">
                  Contact Email
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="contact@example.com"
                  value={websiteInfo.contactEmail}
                  onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                  disabled={isAnalyzing}
                  className="bg-black/60 border-green-500/30 text-white placeholder:text-gray-500 focus:border-green-400 focus:ring-green-400/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white font-medium">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={websiteInfo.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  disabled={isAnalyzing}
                  className="bg-black/60 border-green-500/30 text-white placeholder:text-gray-500 focus:border-green-400 focus:ring-green-400/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-white font-medium">
                Address
              </Label>
              <Input
                id="address"
                placeholder="Business address"
                value={websiteInfo.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                disabled={isAnalyzing}
                className="bg-black/60 border-green-500/30 text-white placeholder:text-gray-500 focus:border-green-400 focus:ring-green-400/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="socialLinks" className="text-white font-medium">
                Social Media Links
              </Label>
              <Textarea
                id="socialLinks"
                placeholder="LinkedIn, Twitter, Instagram, etc. (one per line)"
                value={websiteInfo.socialLinks}
                onChange={(e) => handleInputChange("socialLinks", e.target.value)}
                rows={3}
                disabled={isAnalyzing}
                className="bg-black/60 border-green-500/30 text-white placeholder:text-gray-500 focus:border-green-400 focus:ring-green-400/20 resize-none"
              />
            </div>

            <div className="border-t border-green-500/10 pt-6">
              <div className="flex justify-end">
                <Button 
                  onClick={handleSave} 
                  size="lg" 
                  disabled={isSaving || isAnalyzing || !url}
                  className="bg-green-600 hover:bg-green-500 text-white border-0 shadow-lg shadow-green-500/20 transition-all duration-200 hover:shadow-green-500/40 disabled:bg-gray-800 disabled:text-gray-500 disabled:shadow-none"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Save Context Information
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}