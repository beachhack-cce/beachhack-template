import Sidebar from "../../components/Sidebar";
import { Routes, Route } from "react-router-dom";
import Home from "../../pages/Home";
import styles from "./Dashboard.module.css";

const Dashboard: React.FC = () => {
  return (
    <div className={styles.layout}>
      <Sidebar />

      <main className={styles.content}>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </main>
    </div>
  );
};

export default Dashboard;