function parseJsonBody(body) {
  if (!body) return {};

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (error) {
      return {};
    }
  }

  return typeof body === 'object' ? body : {};
}

module.exports = {
  parseJsonBody
};
