import DashboardCard from "../components/DashboardCard/DashboardCard";
import styles from "./Home.module.css";

const providers = [
  {
    name: "Stripe",
    status: "Healthy" as const,
    score: 98,
    latency: 120,
    traffic: 3400,
  },
  {
    name: "Razorpay",
    status: "Degraded" as const,
    score: 72,
    latency: 480,
    traffic: 2100,
  },
  {
    name: "PayPal",
    status: "Down" as const,
    score: 0,
    latency: null,
    traffic: 0,
  },
];

const Home: React.FC = () => {
  return (
    <div className={styles.grid}>
      {providers.map((p, index) => (
        <DashboardCard key={p.name} {...p} index={index} />
      ))}
    </div>
  );
};

export default Home;