import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ConvertStatement from "./pages/ConvertStatement.jsx";
import BatchHistory from "./pages/BatchHistory.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ConvertStatement />} />
        <Route path="/history" element={<BatchHistory />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
