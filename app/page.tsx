

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-emerald-500/10 via-transparent to-emerald-500/5" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-\[800px\] h-\[400px\] bg-emerald-500/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-\[400px\] h-\[400px\] bg-emerald-500/10 blur-[100px] rounded-full" />
        
        <div className="absolute inset-0 bg-[linear-linear(rgba(16,185,129,0.03)_1px,transparent_1px),linear-linear(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-\[size\:60px_60px\]" />
        
        <div className="relative z-10 flex flex-col items-center justify-center py-20 px-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight">
            <span className="bg-linear-to-r from-emerald-400 via-emerald-300 to-emerald-500 bg-clip-text text-transparent">
              PAPER AI
            </span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl mb-8 text-center max-w-2xl">
            Intelligent Federated Learning Analytics Dashboard
          </p>
          <div className="flex flex-wrap justify-center gap-8 mb-12">
            <StatItem value="Real-time" label="Monitoring" />
            <StatItem value="Smart" label="Analytics" />
            <StatItem value="Secure" label="Federation" />
          </div>
          
          <div className="flex flex-wrap gap-4 justify-center">
            <a 
              href="/dashboard/SmartAnalytics"
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/30 hover:-translate-y-0.5"
            >
              View Analytics
            </a>
            <a 
              href="#overview"
              className="px-8 py-4 bg-gray-800/80 hover:bg-gray-700 text-white font-semibold rounded-xl border border-gray-700 hover:border-emerald-500/50 transition-all duration-300"
            >
              Learn More
            </a>
          </div>
        </div>
      </div>

      <div id="overview" className="relative py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Powerful <span className="text-emerald-400">Features</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Monitor your federated learning nodes with advanced analytics and real-time insights
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              title="Real-time Monitoring"
              description="Track node performance, health status, and metrics in real-time with live updates"
            />
            <FeatureCard 
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
              title="Anomaly Detection"
              description="AI-powered drift detection and anomaly alerts to identify unusual node behavior"
            />
            <FeatureCard 
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              }
              title="Node Comparison"
              description="Compare nodes side-by-side to analyze similarities and detect outliers"
            />
          </div>
        </div>
      </div>

      <div className="py-16 px-6 bg-linear-to-b from-transparent via-emerald-500/5 to-transparent">
        <div className="max-w-4xl mx-auto">
          <div className="p-8 rounded-2xl bg-linear-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-emerald-500/30 transition-all duration-300">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Ready to get started?</h3>
                <p className="text-gray-400">Explore your federated learning cluster analytics now</p>
              </div>
              <a 
                href="/dashboard"
                className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/30 whitespace-nowrap"
              >
                Open Dashboard →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 font-bold text-sm">P</span>
            </div>
            <span className="text-gray-400 text-sm">PAPER AI</span>
          </div>
          <p className="text-gray-500 text-sm">
            © 2024 Paper AI. Federated Learning Analytics.
          </p>
        </div>
      </footer>
    </div>
  )
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-emerald-400">{value}</p>
      <p className="text-gray-500 text-sm">{label}</p>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-linear-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-emerald-500/50 transition-all duration-300 group hover:-translate-y-1">
      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:bg-emerald-500/20 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  )
}
