(() => {
  "use strict";

  const displayValueEl = document.getElementById("displayValue");
  const displayExpressionEl = document.getElementById("displayExpression");
  const keysEl = document.querySelector(".keys");
  const historyPanelEl = document.getElementById("history");
  const historyListEl = document.getElementById("historyList");
  const historyEmptyEl = document.getElementById("historyEmpty");
  const clearHistoryBtn = document.getElementById("clearHistory");
  const historyToggleBtn = document.getElementById("historyToggle");
  const themeToggleBtn = document.getElementById("themeToggle");

  /**
   * Calculator mutable state
   */
  let currentInput = "0";
  let previousValue = null; // number | null
  let pendingOperator = null; // "+" | "-" | "*" | "/" | null
  let lastEvaluatedResult = null; // number | null
  let lastActionWasEvaluation = false;
  const history = [];

  /** Utility functions */
  const isFiniteNumber = (n) => Number.isFinite(n) && !Number.isNaN(n);
  const clampDisplayLength = (s) => (s.length > 16 ? s.slice(0, 16) : s);
  const formatNumber = (value) => {
    if (!isFiniteNumber(value)) return "Error";
    const abs = Math.abs(value);
    const shouldUseExponential = abs !== 0 && (abs >= 1e12 || abs < 1e-6);
    if (shouldUseExponential) {
      return value.toExponential(8).replace(/\.0+e/, "e").replace(/e\+?/, "e");
    }
    // Avoid floating point artifacts
    const rounded = Math.round(value * 1e12) / 1e12;
    return rounded.toString();
  };

  const render = () => {
    displayValueEl.textContent = clampDisplayLength(currentInput);
    const expr = buildExpressionString();
    displayExpressionEl.textContent = expr;
  };

  const buildExpressionString = () => {
    const parts = [];
    if (previousValue !== null) parts.push(formatNumber(previousValue));
    if (pendingOperator) parts.push(pendingOperator);
    if (!lastActionWasEvaluation && currentInput !== null) parts.push(currentInput);
    return parts.join(" ");
  };

  const pushHistory = (expression, result) => {
    history.unshift({ expression, result });
    renderHistory();
  };

  const renderHistory = () => {
    historyListEl.innerHTML = "";
    if (history.length === 0) {
      historyEmptyEl.classList.remove("hidden");
      return;
    }
    historyEmptyEl.classList.add("hidden");
    for (const item of history) {
      const li = document.createElement("li");
      li.className = "history__item";
      const expr = document.createElement("div");
      expr.className = "history__expr";
      expr.textContent = item.expression;
      const result = document.createElement("div");
      result.className = "history__result";
      result.textContent = item.result;
      li.appendChild(expr);
      li.appendChild(result);
      li.tabIndex = 0;
      li.title = "Click to reuse result";
      li.addEventListener("click", () => {
        currentInput = item.result;
        previousValue = null;
        pendingOperator = null;
        lastEvaluatedResult = Number(item.result);
        lastActionWasEvaluation = false;
        render();
      });
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          li.click();
        }
      });
      historyListEl.appendChild(li);
    }
  };

  const clearAll = () => {
    currentInput = "0";
    previousValue = null;
    pendingOperator = null;
    lastActionWasEvaluation = false;
    render();
  };

  const clearEntry = () => {
    currentInput = "0";
    lastActionWasEvaluation = false;
    render();
  };

  const backspace = () => {
    if (lastActionWasEvaluation) return; // do nothing after equals
    if (currentInput.length <= 1) currentInput = "0";
    else currentInput = currentInput.slice(0, -1);
    render();
  };

  const inputDigit = (d) => {
    if (lastActionWasEvaluation) {
      // Start new input after evaluation
      currentInput = d;
      previousValue = null;
      pendingOperator = null;
      lastActionWasEvaluation = false;
      render();
      return;
    }
    if (currentInput === "0") currentInput = d; else currentInput += d;
    render();
  };

  const inputDecimal = () => {
    if (lastActionWasEvaluation) {
      currentInput = "0.";
      previousValue = null;
      pendingOperator = null;
      lastActionWasEvaluation = false;
      render();
      return;
    }
    if (!currentInput.includes(".")) currentInput += ".";
    render();
  };

  const toggleSign = () => {
    if (currentInput === "0") return;
    if (currentInput.startsWith("-")) currentInput = currentInput.slice(1);
    else currentInput = "-" + currentInput;
    render();
  };

  const percent = () => {
    const current = Number(currentInput);
    if (!isFiniteNumber(current)) return;
    if (previousValue !== null && pendingOperator) {
      currentInput = formatNumber((previousValue * current) / 100);
    } else {
      currentInput = formatNumber(current / 100);
    }
    render();
  };

  const ans = () => {
    if (lastEvaluatedResult === null) return;
    if (lastActionWasEvaluation) {
      currentInput = formatNumber(lastEvaluatedResult);
      lastActionWasEvaluation = false;
    } else if (currentInput === "0") {
      currentInput = formatNumber(lastEvaluatedResult);
    } else {
      // Replace if current is not a valid number string
      currentInput = formatNumber(lastEvaluatedResult);
    }
    render();
  };

  const operate = (a, b, op) => {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return b === 0 ? NaN : a / b;
      default: return b;
    }
  };

  const setOperator = (op) => {
    const current = Number(currentInput);
    if (previousValue === null) {
      previousValue = current;
      pendingOperator = op;
      currentInput = "0";
      lastActionWasEvaluation = false;
      render();
      return;
    }
    if (!pendingOperator) {
      pendingOperator = op;
      lastActionWasEvaluation = false;
      render();
      return;
    }
    // If there is a pending operator and user chains another operator, compute
    const result = operate(previousValue, current, pendingOperator);
    previousValue = result;
    pendingOperator = op;
    currentInput = "0";
    lastActionWasEvaluation = false;
    render();
  };

  const equals = () => {
    if (pendingOperator === null || previousValue === null) {
      // nothing to compute
      lastEvaluatedResult = Number(currentInput);
      lastActionWasEvaluation = true;
      displayExpressionEl.textContent = "";
      render();
      return;
    }
    const a = previousValue;
    const b = Number(currentInput);
    const op = pendingOperator;
    const raw = operate(a, b, op);
    const resultStr = formatNumber(raw);
    const expr = `${formatNumber(a)} ${op} ${formatNumber(b)} =`;

    pushHistory(expr, resultStr);

    currentInput = resultStr;
    previousValue = null;
    pendingOperator = null;
    lastEvaluatedResult = Number(resultStr);
    lastActionWasEvaluation = true;
    render();
  };

  // Event delegation for keys
  keysEl.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("key")) return;
    const digit = target.getAttribute("data-digit");
    const op = target.getAttribute("data-op");
    const action = target.getAttribute("data-action");
    if (digit) inputDigit(digit);
    else if (op) setOperator(op);
    else if (action === "decimal") inputDecimal();
    else if (action === "plusminus") toggleSign();
    else if (action === "backspace") backspace();
    else if (action === "clear-all") clearAll();
    else if (action === "clear") clearEntry();
    else if (action === "percent") percent();
    else if (action === "equals") equals();
    else if (action === "ans") ans();
  });

  // Keyboard support
  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) return;
    const key = e.key;
    if (/^\d$/.test(key)) { inputDigit(key); return; }
    switch (key) {
      case ".": inputDecimal(); break;
      case "+": case "-": case "*": case "/": setOperator(key); break;
      case "Enter": case "=": equals(); break;
      case "Backspace": backspace(); break;
      case "Delete": clearEntry(); break;
      case "Escape": clearAll(); break;
      case "%": percent(); break;
      case "a": case "A": ans(); break;
      default: return;
    }
    e.preventDefault();
  });

  // History controls
  historyToggleBtn.addEventListener("click", () => {
    const hidden = historyPanelEl.getAttribute("aria-hidden") === "true";
    historyPanelEl.setAttribute("aria-hidden", hidden ? "false" : "true");
  });

  clearHistoryBtn.addEventListener("click", () => {
    history.splice(0, history.length);
    renderHistory();
  });

  // Theme toggle (persist preference)
  const applyTheme = (theme) => {
    if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
  };
  const savedTheme = localStorage.getItem("calc_theme") || "";
  applyTheme(savedTheme);
  themeToggleBtn.addEventListener("click", () => {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const next = isLight ? "" : "light";
    localStorage.setItem("calc_theme", next);
    applyTheme(next);
  });

  // Initial render
  render();
})();

