export function adjustPriceForCompanyActions(price, actions = []) {
  return actions.reduce((current, action) => {
    if (action.type === "split") return current / (action.ratio || 1);
    if (action.type === "cash_dividend") return current - (action.amount || 0);
    if (action.type === "rights_issue") return (current + (action.subscriptionPrice || 0) * (action.ratio || 0)) / (1 + (action.ratio || 0));
    return current;
  }, price);
}

export function actionLabel(action) {
  if (action.type === "split") return `拆分 ${action.ratio}:1`;
  if (action.type === "cash_dividend") return `现金分红 ${action.amount.toFixed(2)} 元`;
  if (action.type === "rights_issue") return `配股 ${action.ratio}:1 @ ${action.subscriptionPrice.toFixed(2)}`;
  return "其他公司行为";
}

