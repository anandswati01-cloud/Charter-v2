/* ── SkyVayu — Graphify: Claude AI Chart Intelligence ── */
/* Uses the graphify skill (skill_01WY5BbRr7drWMiywieitAsg) from platform.claude.com */

(function() {
  'use strict';

  /* ── Configuration ── */
  var GRAPHIFY_SKILL_ID = 'skill_01WY5BbRr7drWMiywieitAsg';
  var CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
  var CLAUDE_MODEL = 'claude-opus-4-5';

  /**
   * graphifyData — Ask Claude (with the graphify skill) to analyse
   * an array of data objects and return chart-ready insights.
   *
   * @param {object} opts
   * @param {Array}  opts.data       - Array of data objects to analyse
   * @param {string} opts.question   - Natural-language question about the data
   * @param {string} opts.apiKey     - Anthropic API key (from platform.claude.com/settings/...)
   * @param {string} [opts.chartType] - Preferred chart type hint (bar, line, pie, scatter)
   * @returns {Promise<object>}       - { summary, chartConfig, insights }
   */
  async function graphifyData(opts) {
    var data      = opts.data      || [];
    var question  = opts.question  || 'Summarise this data with a chart';
    var apiKey    = opts.apiKey;
    var chartType = opts.chartType || 'auto';

    if (!apiKey) {
      throw new Error('graphifyData: apiKey is required. Get one from platform.claude.com/settings/workspaces/default/keys');
    }

    var systemPrompt = [
      'You are a data-visualisation expert for SkyVayu, a private charter flight platform.',
      'When given flight booking or quote data, produce clear chart configurations.',
      'Always respond with valid JSON containing: summary (string), chartConfig (object), insights (array of strings).',
      'chartConfig must follow Chart.js v4 format with type, data.labels, data.datasets fields.'
    ].join(' ');

    var userMessage = [
      'Analyse this SkyVayu data and answer: ' + question,
      'Chart type preference: ' + chartType,
      '',
      'Data:',
      JSON.stringify(data, null, 2)
    ].join('\n');

    var body = {
      model:      CLAUDE_MODEL,
      max_tokens: 1024,
      system:     systemPrompt,
      tools: [
        {
          type: 'skill',
          name: 'graphify',
          id:   GRAPHIFY_SKILL_ID
        }
      ],
      messages: [
        { role: 'user', content: userMessage }
      ]
    };

    var response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':            'application/json',
        'x-api-key':               apiKey,
        'anthropic-version':       '2023-06-01',
        'anthropic-beta':          'skills-2025-03-05'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      var errText = await response.text();
      throw new Error('Claude API error ' + response.status + ': ' + errText);
    }

    var result = await response.json();

    /* Extract the text content from the response */
    var textBlock = (result.content || []).find(function(b) { return b.type === 'text'; });
    var raw = textBlock ? textBlock.text : '{}';

    /* Strip markdown code fences if present */
    raw = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

    try {
      return JSON.parse(raw);
    } catch (e) {
      return { summary: raw, chartConfig: null, insights: [] };
    }
  }

  /**
   * renderGraphifyChart — Renders a Chart.js chart from graphifyData output.
   * Requires Chart.js to be loaded on the page.
   *
   * @param {HTMLCanvasElement} canvas  - Target <canvas> element
   * @param {object}           config  - chartConfig returned by graphifyData
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

  console.log('[graphify] SkyVayu chart intelligence loaded. Skill ID:', GRAPHIFY_SKILL_ID);
})();
