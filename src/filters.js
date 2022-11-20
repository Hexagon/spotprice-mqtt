
// Find electricity price at a specific time
function findPriceAt(result, targetDate) {
    for(let row of result)
        if(row.startTime <= targetDate && row.endTime > targetDate)
            return row.spotPrice;
}

// Find average electricity price at a specific time, between to times
function avgPriceBetween(result, date, offsetFrom, offsetTo) {
    let sum = 0,
        count = 0;
    const
        from = new Date(date.getTime()+offsetFrom),
        to = new Date(date.getTime()+offsetTo);
    for(let row of result) {
        if(row.startTime >= from && row.endTime <= to) {
            sum += row.spotPrice;
            count++;
        }
    }
    return sum/count;
}

// Find max price
function findMinMaxPriceAtDate(result, targetDate) {
    let maxTime, maxVal = -Infinity;
    let minTime, minVal = Infinity;
    for(let row of result) {
        if(((row.startTime <= targetDate && row.endTime > targetDate) || row.startTime > targetDate) && targetDate.toLocaleDateString() == row.startTime.toLocaleDateString()) {
            if (maxVal === undefined || maxVal < row.spotPrice ) {
                maxVal = row.spotPrice;
                maxTime = row.startTime;
            }
            if (minVal > row.spotPrice ) {
                minVal = row.spotPrice;
                minTime = row.startTime;
            }
        }
    }
    return {
        maxVal: maxVal === -Infinity ? null : maxVal,
        minVal: minVal === Infinity ? null : minVal,
        maxTime: maxTime ? maxTime.toISOString() : "",
        minTime: minTime ? minTime.toISOString() : ""
    };
}

export { findPriceAt, findMinMaxPriceAtDate, avgPriceBetween };