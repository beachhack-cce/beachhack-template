import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github, Terminal, GitBranch, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Navbar */}
      <header className="px-6 h-16 flex items-center border-b border-border/40">
        <div className="flex items-center gap-2 font-bold text-xl">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
            <Zap size={20} fill="currentColor" />
          </div>
          <span>RygtusBuild</span>
        </div>
        <div className="ml-auto">
          <Link href="/connect">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-sm text-muted-foreground bg-secondary/50 backdrop-blur-sm mb-4">
            <span className="flex size-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
            Hackathon Ready CI/CD
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent">
            Build pipelines <br /> visually.
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Connect your GitHub repo, analyze your stack, and generate production-ready GitHub Actions workflows in minutes.
          </p>

          <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/connect">
              <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20">
                <Github className="mr-2 size-5" />
                Connect GitHub
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto px-4">
          <FeatureCard
            icon={<Github className="size-6" />}
            title="GitHub Integration"
            description="Seamlessly authenticate and read your repositories with secure OAuth or PAT."
          />
          <FeatureCard
            icon={<Terminal className="size-6" />}
            title="Smart Analysis"
            description="Automatically detects your tech stack (Node, Python, Docker) to suggest pipelines."
          />
          <FeatureCard
            icon={<GitBranch className="size-6" />}
            title="Visual Builder"
            description="Drag and drop steps to build your workflow and commit directly to your branch."
          />
        </div>
      </main>

      <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-black [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e_100%)] dark:[background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)] opacity-20 pointer-events-none" />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-2xl border bg-card/50 backdrop-blur-sm card-hover hover:border-primary/50 transition-colors">
      <div className="mb-4 p-3 rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  )
}
