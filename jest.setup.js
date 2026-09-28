global.fetch = () => {
  throw new Error('real network in tests');
};
