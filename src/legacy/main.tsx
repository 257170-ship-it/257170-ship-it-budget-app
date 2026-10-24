import ReactDOM from "react-dom/client";
import { BudgetProvider } from "./context/BudgetContext";
import App from "./App";
import "./App.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <BudgetProvider>
    <App />
  </BudgetProvider>,
);
