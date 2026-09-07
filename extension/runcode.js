// TrucnksCISCO - Script Evaluator for Cisco Packet Tracer IPC
function runCode(scriptText) {
  try {
    var codeFunction = new Function(scriptText);
    try {
      return { success: true, result: codeFunction(), code: scriptText };
    } catch (error) {
      return {
        success: false,
        error: "Execution error: " + (error ? (error.message || String(error)) : "Unknown error"),
        code: scriptText
      };
    }
  } catch (error) {
    return {
      success: false,
      error: "Syntax error: " + (error ? (error.message || String(error)) : "Unknown syntax error"),
      code: scriptText
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { runCode };
}
