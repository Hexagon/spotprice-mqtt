// Find electricity price at a specific time
function findPriceAt(result, targetDate) {
  for (const row of result) {
     if (row.time <= targetDate && new Date((row.time.getTime() + 3600*1000)) > targetDate) {
      return row.price;
    }
  }
}

// Find average electricity price at a specific time, between to times
function avgPriceBetween(result, date, offsetFrom, offsetTo) {
  let sum = 0,
    count = 0;
  const from = new Date(date.getTime() + offsetFrom),
    to = new Date(date.getTime() + offsetTo);
  for (const row of result) {
    if (row.time >= from && row.time <= to) {
      sum += row.price;
      count++;
    }
  }
  return sum / count;
}

// Find max price
function findMinMaxPriceAtDate(result, targetDate) {
  let maxTime, maxVal = -Infinity;
  let minTime, minVal = Infinity;
  for (const row of result) {
    if (((row.time <= targetDate && row.time + 3600*1000 > targetDate) || row.time > targetDate) && targetDate.toLocaleDateString() == row.time.toLocaleDateString()) {
      if (maxVal === undefined || maxVal < row.price) {
        maxVal = row.price;
        maxTime = row.time;
      }
      if (minVal > row.price) {
        minVal = row.price;
        minTime = row.time;
      }
    }
  }
  return {
    maxVal: maxVal === -Infinity ? null : maxVal,
    minVal: minVal === Infinity ? null : minVal,
    maxTime: maxTime ? maxTime.toISOString() : "",
    minTime: minTime ? minTime.toISOString() : "",
  };
}

export { avgPriceBetween, findMinMaxPriceAtDate, findPriceAt };
