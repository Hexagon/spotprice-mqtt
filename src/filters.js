
// Find electricity price at a specific time
function findPriceAt(result, targetDate) {
    for(let row of result)
        if(row.startTime <= targetDate && row.endTime > targetDate)
            return row.spotPrice;
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
        maxVal: maxVal === -Infinity ? "" : maxVal,
        minVal: minVal === Infinity ? "" : minVal,
        maxTime: maxTime ? maxTime.toISOString() : "",
        minTime: minTime ? minTime.toISOString() : ""
    };
}

export { findPriceAt, findMinMaxPriceAtDate };