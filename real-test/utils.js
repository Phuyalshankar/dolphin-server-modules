export const formatCurrency = (amount) => {
  return `$${amount.toFixed(2)}`;
};

export const logger = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
};
