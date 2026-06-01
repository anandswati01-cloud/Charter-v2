/* — SkyVayu — Graphify: Claude AI Chart Intelligence — */
/* Routes through Supabase Edge Function 'claude-chart' so the Anthropic  */
/* API key stays server-side and is never exposed to the browser.          */

(function() {
  'use strict';

  /* — Configuration — */
  var EDGE_FUNCTION_URL = 'https://bkumggqijgxyfotpbcni.supabase.co/functions/v1/claude-chart';

  /**
   * graphifyData — Ask Claude (via the claude-chart Edge Function) to analyse
   * an array of data objects and return chart-ready insights.
   *
   * @param {object} opts
   * @param {Array}  opts.data        – Array of data objects to analyse
   * @param {string} opts.question    – Natural-language question about the data
   * @param {string} [opts.chartType] – Preferred chart type hint (bar, line, pie, scatter)
   * @returns {Promise<object>}       – { summary, chartConfig, insights }
   */
  async function graphifyData(opts) {
    var data      = opts.data      || [];
    var question  = opts.question  || 'Summarise this data with a chart';
    var chartType = opts.chartType || 'auto';

    try {
      var response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: data, question: question, chartType: chartType }),
      });

      if (!response.ok) {
        var errText = await response.text();
        throw new Error('claude-chart error ' + response.status + ': ' + errText);
      }

      var result = await response.json();
      return result;

    } catch (e) {
      console.error('graphifyData error:', e);
      return { summary: e.message || 'Error contacting chart service', chartConfig: null, insights: [] };
    }
  }

  /**
   * renderGraphifyChart — Renders a Chart.js chart from graphifyData output.
   * Requires Chart.js to be loaded on the page.
   *
   * @param {HTMLCanvasElement} canvas  – Target <canvas> element
   * @param {object}            config  – chartConfig returned by graphifyData
   */
  function renderGraphifyChart(canvas, config) {
    if (!canvas || !config) return;
    if (typeof Chart === 'undefined') {
      console.warn('graphify: Chart.js not found. Load it before calling renderGraphifyChart.');
      return;
    }

    /* Destroy existing chart if any */
    var existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    new Chart(canvas, config);
  }

  /* Expose to global scope */
  window.graphifyData        = graphifyData;
  window.renderGraphifyChart = renderGraphifyChart;

}());
