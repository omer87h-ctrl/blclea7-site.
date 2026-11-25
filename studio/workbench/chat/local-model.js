/* Owned CLEA7500 decoder for the public app. No pairing, no owner server, no Qwen weights. */
(function (root) {
  function tokens(text) {
    return (text.normalize('NFKC').toLowerCase().match(/\w+|[^\w\s]/gu) || []);
  }
  function decode(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  }
  function dot(row, matrix, columns, bias) {
    const out = new Float32Array(columns);
    if (bias) out.set(bias);
    for (let i = 0; i < row.length; i++) {
      const value = row[i];
      if (!value) continue;
      const start = i * columns;
      for (let j = 0; j < columns; j++) out[j] += value * matrix[start + j];
    }
    return out;
  }
  function meanRows(table, width, ids) {
    const out = new Float32Array(width);
    for (const id of ids) {
      const start = id * width;
      for (let j = 0; j < width; j++) out[j] += table[start + j];
    }
    for (let j = 0; j < width; j++) out[j] /= ids.length;
    return out;
  }
  function tanh(values) {
    const out = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) out[i] = Math.tanh(values[i]);
    return out;
  }
  function load(data) {
    if (data.format !== 'clea7500.learned-assistant/1') throw new Error('Nepoznat CLEA model.');
    const width = data.dimensions.embedding, hidden = data.dimensions.hidden;
    const weights = {};
    for (const name of Object.keys(data.weights)) weights[name] = decode(data.weights[name].data);
    const index = new Map(data.tokenizer.vocabulary.map((word, i) => [word, i]));
    function encode(question) {
      const ids = [4];
      for (const word of tokens(question).slice(0, 79)) ids.push(index.get(word) ?? 3);
      return ids;
    }
    function context(ids) {
      const averaged = meanRows(weights.Q, width, ids);
      return tanh(dot(averaged, weights.Wq, hidden, weights.bq));
    }
    function generate(question, maximum) {
      const ids = encode(question);
      const memory = meanRows(weights.Q, width, ids);
      const state = tanh(dot(memory, weights.Wq, hidden, weights.bq));
      const words = [];
      let previous = 1;
      const limit = Math.min(48, maximum || 48);
      for (let step = 0; step < limit; step++) {
        const embedded = weights.E.subarray(previous * width, (previous + 1) * width);
        const mixed = dot(embedded, weights.Wx, hidden, null);
        const recurrent = dot(state, weights.Wh, hidden, null);
        const carried = dot(memory, weights.Wc, hidden, weights.bh);
        for (let i = 0; i < hidden; i++) mixed[i] = Math.tanh(mixed[i] + recurrent[i] + carried[i]);
        const scores = dot(mixed, weights.Wo, data.dimensions.vocabulary, weights.bo);
        scores[0] = scores[1] = scores[3] = scores[4] = scores[5] = -1e9;
        previous = 0;
        for (let i = 1; i < scores.length; i++) if (scores[i] > scores[previous]) previous = i;
        state.set(mixed);
        if (previous === 2) break;
        words.push(data.tokenizer.vocabulary[previous]);
      }
      return words.join(' ').replace(/\s+([.,!?;:%)])/g, '$1').replace(/([(])\s+/g, '$1');
    }
    return {
      name: 'CLEA7500',
      parameters: data.training.parameterCount,
      fingerprint: data.modelFingerprint,
      qwenWeights: false,
      pairingRequired: false,
      generate
    };
  }
  root.CLEAPublicModel = { load };
})(typeof globalThis !== 'undefined' ? globalThis : window);
