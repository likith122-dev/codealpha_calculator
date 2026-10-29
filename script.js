
"use strict";

const expressionDisplay = document.getElementById("expression");
const resultDisplay = document.getElementById("result");
const keypad = document.querySelector(".keypad");

let expression = "";
let justCalculated = false;
let hasError = false;

const OPERATORS = ["+", "-", "*", "/"];
const NUMBER_PATTERN = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const TOKEN_PATTERN = /(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[+\-*/%]/gi;

// ---------- DISPLAY HELPERS ----------

function formatExpression(value) {
    return value
        .replace(/\*/g, " × ")
        .replace(/\//g, " ÷ ")
        .replace(/\+/g, " + ")
        .replace(/-/g, " − ")
        .replace(/\s+/g, " ")
        .trim();
}

function formatNumber(value) {
    if (!Number.isFinite(value)) {
        throw new Error("Result is out of range");
    }

    if (Object.is(value, -0) || value === 0) {
        return "0";
    }

    return String(Number(value.toPrecision(12)));
}

function updateDisplay() {
    if (hasError) return;

    expressionDisplay.textContent = formatExpression(expression);

    if (!expression) {
        resultDisplay.textContent = "0";
        return;
    }

    // An incomplete expression is not ready to calculate.
    if (/[+\-*/.]$/.test(expression)) {
        resultDisplay.textContent = "…";
        return;
    }

    try {
        resultDisplay.textContent = formatNumber(calculate(expression));
    } catch {
        resultDisplay.textContent = "…";
    }
}

// ---------- SAFE ARITHMETIC PARSER ----------
// Supports +, -, *, /, unary signs and postfix %.
// Does not use eval() or Function().

function calculate(input) {
    if (!input || input.length > 300) {
        throw new Error("Invalid expression");
    }

    const tokens = input.match(TOKEN_PATTERN);

    if (!tokens || tokens.join("") !== input) {
        throw new Error("Invalid expression");
    }

    let position = 0;

    function parseExpression() {
        let value = parseTerm();

        while (
            tokens[position] === "+" ||
            tokens[position] === "-"
        ) {
            const operator = tokens[position++];
            const right = parseTerm();

            value = operator === "+"
                ? value + right
                : value - right;

            ensureFinite(value);
        }

        return value;
    }

    function parseTerm() {
        let value = parseUnary();

        while (
            tokens[position] === "*" ||
            tokens[position] === "/"
        ) {
            const operator = tokens[position++];
            const right = parseUnary();

            if (operator === "/" && right === 0) {
                throw new Error("Cannot divide by zero");
            }

            value = operator === "*"
                ? value * right
                : value / right;

            ensureFinite(value);
        }

        return value;
    }

    function parseUnary() {
        if (tokens[position] === "+") {
            position++;
            return parseUnary();
        }

        if (tokens[position] === "-") {
            position++;
            return -parseUnary();
        }

        return parsePercentage();
    }

    function parsePercentage() {
        const token = tokens[position];

        if (!token || !NUMBER_PATTERN.test(token)) {
            throw new Error("Invalid number");
        }

        position++;

        let value = Number(token);
        ensureFinite(value);

        while (tokens[position] === "%") {
            position++;
            value /= 100;
        }

        return value;
    }

    function ensureFinite(value) {
        if (!Number.isFinite(value)) {
            throw new Error("Result is out of range");
        }
    }

    const answer = parseExpression();

    if (position !== tokens.length) {
        throw new Error("Invalid expression");
    }

    ensureFinite(answer);
    return answer;
}

// ---------- INPUT HELPERS ----------

function clearCalculator() {
    expression = "";
    justCalculated = false;
    hasError = false;
    updateDisplay();
}

function appendValue(value) {
    if (hasError) {
        clearCalculator();
    }

    if (justCalculated) {
        // Continue with an operator; start fresh with a number.
        if (!OPERATORS.includes(value)) {
            expression = "";
        }

        justCalculated = false;
    }

    if (/^\d$/.test(value)) {
        expression += value;
        updateDisplay();
        return;
    }

    if (value === ".") {
        const lastNumber = expression.match(
            /(?:^|[+\-*/])(\d*\.?\d+(?:e[+-]?\d+)?)$/i
        );

        if (lastNumber && lastNumber[1].includes(".")) {
            return;
        }

        if (!expression || /[+\-*/]$/.test(expression)) {
            expression += "0.";
        } else {
            expression += ".";
        }

        updateDisplay();
        return;
    }

    if (value === "%") {
        if (/[\d%]$/.test(expression)) {
            expression += "%";
            updateDisplay();
        }
        return;
    }

    if (OPERATORS.includes(value)) {
        if (!expression) {
            if (value === "-") {
                expression = "-";
                updateDisplay();
            }
            return;
        }

        if (/[+\-*/]$/.test(expression)) {
            const lastOperator = expression.slice(-1);

            // Permit a negative number after multiplication or division.
            if (
                value === "-" &&
                (lastOperator === "*" || lastOperator === "/")
            ) {
                expression += "-";
            } else if (
                value === "-" &&
                lastOperator === "+"
            ) {
                expression = expression.slice(0, -1) + "-";
            } else {
                expression = expression.slice(0, -1) + value;
            }
        } else {
            expression += value;
        }

        updateDisplay();
    }
}

function deleteLast() {
    if (hasError) {
        clearCalculator();
        return;
    }

    expression = expression.slice(0, -1);
    justCalculated = false;
    updateDisplay();
}

function toggleSign() {
    if (!expression || hasError) return;

    justCalculated = false;

    // Find the final numeric operand, optionally followed by %.
    const match = expression.match(
        /(\d*\.?\d+(?:e[+-]?\d+)?%?)$/i
    );

    if (!match) {
        if (/[+*/]$/.test(expression)) {
            expression += "-";
        } else if (expression === "-") {
            expression = "";
        }

        updateDisplay();
        return;
    }

    const start = match.index;
    const previous = expression[start - 1];
    const beforePrevious = expression[start - 2];

    // Remove an existing unary minus, or insert one.
    if (
        previous === "-" &&
        (
            start - 1 === 0 ||
            OPERATORS.includes(beforePrevious)
        )
    ) {
        expression =
            expression.slice(0, start - 1) +
            expression.slice(start);
    } else {
        expression =
            expression.slice(0, start) +
            "-" +
            expression.slice(start);
    }

    updateDisplay();
}

// ---------- CALCULATION ----------

function calculateResult() {
    if (!expression || hasError) return;

    try {
        const answer = calculate(expression);
        const formattedAnswer = formatNumber(answer);

        expressionDisplay.textContent =
            formatExpression(expression) + " =";

        resultDisplay.textContent = formattedAnswer;

        expression = formattedAnswer;
        justCalculated = true;
    } catch (error) {
        expressionDisplay.textContent =
            error.message === "Cannot divide by zero"
                ? "Cannot divide by zero"
                : "Invalid calculation";

        resultDisplay.textContent = "Error";
        hasError = true;
        justCalculated = false;
    }
}

// ---------- BUTTON EVENTS ----------

keypad.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button || !keypad.contains(button)) return;

    const { value, action } = button.dataset;

    if (value !== undefined) {
        appendValue(value);
        return;
    }

    switch (action) {
        case "clear":
            clearCalculator();
            break;

        case "delete":
            deleteLast();
            break;

        case "percent":
            appendValue("%");
            break;

        case "sign":
            toggleSign();
            break;

        case "equals":
            calculateResult();
            break;
    }
});

// ---------- KEYBOARD SUPPORT ----------

document.addEventListener("keydown", (event) => {
    // Do not intercept shortcuts while typing into another input.
    if (
        event.target instanceof HTMLElement &&
        (
            event.target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
        )
    ) {
        return;
    }

    const key = event.key;

    if (/^\d$/.test(key) || key === ".") {
        appendValue(key);
    } else if (OPERATORS.includes(key)) {
        appendValue(key);
    } else if (key === "x" || key === "X") {
        appendValue("*");
    } else if (key === "Enter" || key === "=") {
        event.preventDefault();
        calculateResult();
    } else if (key === "Backspace") {
        event.preventDefault();
        deleteLast();
    } else if (key === "Escape" || key === "Delete") {
        clearCalculator();
    } else if (key === "%") {
        appendValue("%");
    }
});

// ---------- INITIALIZE ----------

updateDisplay();
