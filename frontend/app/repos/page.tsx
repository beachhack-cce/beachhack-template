"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Repo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, GitFork, Star, Lock, Globe, Loader2, ArrowRight } from "lucide-react";

export default function ReposPage() {
    const router = useRouter();
    const [repos, setRepos] = useState<Repo[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selecting, setSelecting] = useState<number | null>(null);

    useEffect(() => {
        fetchRepos();
    }, []);

    const fetchRepos = async () => {
        try {
            const { data } = await api.get<Repo[]>("/repos/");
            setRepos(data);
        } catch (err) {
            console.error(err);
            // If auth fails, redirect to connect
            router.push("/connect");
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (repo: Repo) => {
        setSelecting(repo.id);
        try {
            await api.post("/repos/select", { owner: repo.owner, repo: repo.name });
            router.push("/pipeline");
        } catch (err) {
            console.error(err);
            setSelecting(null);
        }
    };

    const filteredRepos = repos.filter(r =>
        r.full_name.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="size-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Select a Repository</h1>
                    <p className="text-muted-foreground">Choose a repository to set up a CI/CD pipeline.</p>
                </div>
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                        placeholder="Search repositories..."
                        className="pl-9 bg-background/50 backdrop-blur-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRepos.map((repo) => (
                    <Card key={repo.id} className="group hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <CardTitle className="text-lg font-medium leading-tight truncate pr-4" title={repo.full_name}>
                                    {repo.full_name}
                                </CardTitle>
                                <Badge variant={repo.private ? "secondary" : "outline"} className="shrink-0">
                                    {repo.private ? <Lock className="size-3 mr-1" /> : <Globe className="size-3 mr-1" />}
                                    {repo.private ? "Private" : "Public"}
                                </Badge>
                            </div>
                            <CardDescription className="line-clamp-2 h-10">
                                {repo.description || "No description provided."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <span className="size-2 rounded-full bg-blue-500"></span>
                                    Build Ready
                                </span>
                                {/* Mock data for now as GitHub API doesn't always return stars in light schema unless requested */}
                                <span className="flex items-center gap-1"><Star className="size-3" /> 0</span>
                                <span className="flex items-center gap-1"><GitFork className="size-3" /> 0</span>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button
                                className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                                onClick={() => handleSelect(repo)}
                                disabled={selecting !== null}
                            >
                                {selecting === repo.id ? (
                                    <>
                                        <Loader2 className="mr-2 size-4 animate-spin" />
                                        Selecting...
                                    </>
                                ) : (
                                    <>
                                        Set up Pipeline
                                        <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {filteredRepos.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                    No repositories found matching "{search}".
                </div>
            )}
        </div>
    );
}
