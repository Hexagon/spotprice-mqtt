import { spotprice } from "https://deno.land/x/spotprice@0.0.3/dist/spotprice.min.mjs";
import { Client } from 'https://deno.land/x/mqtt@0.1.2/deno/mod.ts';
import { parse } from "https://deno.land/std/flags/mod.ts"

// Parse arguments
const spArgs = parse(Deno.args, {
    default: { host: undefined, port: undefined, topic: "homeassistant/sensor/", entity:"spotprice", area: "SE2", currency: "SEK", decimals: 5, factor: 1, extra: 0 }
});

// Send to mqtt
const
    baseTopic = spArgs.topic.toLowerCase().trim(),
    baseEntity = spArgs.entity.toLowerCase().trim(),
    spCurrency = spArgs.currency.trim().toUpperCase(),
    spArea = spArgs.area.trim().toUpperCase(),
    spDecimals = parseInt(spArgs.decimals, 10),
    spFactor = parseFloat(spArgs.factor),
    spExtra = parseFloat(spArgs.extra),
    mqttHost = spArgs.host,
    mqttPort = spArgs.port;

function logger(msg) {
    console.log(new Date().toLocaleString() + " - " + msg);
}

// Connect to mqtt service
let 
    client,
    connected = false;
try {
    // Start timeout
    const connectionTimeout = setTimeout(() => { 
        if(!connected) {
            logger("Connection timed out after 20 seconds");
            Deno.exit(1);
        }
    }, 20*1000);
    client = new Client({ url: `mqtt://${mqttHost}:${mqttPort}` });
    await client.connect();
    connected = true;
    clearTimeout(connectionTimeout);
} catch (e) {
    logger("failed to connect " + e.toString());
    Deno.exit(1);
}

// Fetch data
const
    oneHourMs = 3600*1000,
    oneDayMs = oneHourMs*24;

let result;
try {
    result = [
        ...await spotprice("hourly", spArea, spCurrency, new Date()),
        ...await spotprice("hourly", spArea, spCurrency, new Date(new Date().getTime()+oneDayMs)),
    ];
} catch (e) {
    logger("failed to fetch " + e.toString());
    Deno.exit(1);
}

// Find electricity price now
function findPriceAt(targetDate) {
    for(let row of result)
        if(row.startTime <= targetDate && row.endTime > targetDate)
            return row.spotPrice;
}
// Find max price
function findMinMaxPriceAtDate(targetDate) {
    let maxTime, maxVal;
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
        maxVal,
        minVal,
        maxTime,
        minTime
    };
}

async function publishDevice(name, id, state) {
    logger("publishing " + name + " " + state);
    let
        stateTopic = baseTopic + id + "/state",
        configTopic = baseTopic + id + "/config",
        deviceConfig = {
            device_class: "monetary",
            name: name,
            state_topic: stateTopic,
            unit_of_measurement: spCurrency + "/kWh",
            object_id: id
        };
    try {
        await client.publish(configTopic, JSON.stringify(deviceConfig)); 
        await client.publish(stateTopic, state);
    } catch (e) {
        logger("failed to publish " + e.toString());
        Deno.exit(1)
    }
}

function preparePrice(price) {
    price = (price + spExtra) * spFactor;
    return price.toFixed(spDecimals);
}

const dateTomorrow = new Date(new Date().getTime()+oneDayMs);
dateTomorrow.setHours(0);
dateTomorrow.setMinutes(0);
dateTomorrow.setSeconds(1);

const
    extremesToday = findMinMaxPriceAtDate(new Date()),
    extremesTomorrow = findMinMaxPriceAtDate(dateTomorrow);

await publishDevice("Spot price now", baseEntity + "_now", preparePrice(findPriceAt(new Date())/1000));
await publishDevice("Spot price in 1 hour", baseEntity + "_1h", preparePrice(findPriceAt(new Date(new Date().getTime()+oneHourMs))/1000));
await publishDevice("Spot price in 6 hours", baseEntity + "_6h", preparePrice(findPriceAt(new Date(new Date().getTime()+oneHourMs*6))/1000));
await publishDevice("Spot price in 12 hours", baseEntity + "_12h", preparePrice(findPriceAt(new Date(new Date().getTime()+oneHourMs*12))/1000));
await publishDevice("Highest upcomping spot price today ", baseEntity + "_today_max", preparePrice(extremesToday.maxVal/1000));
await publishDevice("Highest upcomping spot price today time", baseEntity + "_today_max_time", extremesToday.maxTime.toISOString());
await publishDevice("Lowest upcomping spot price today", baseEntity + "_today_min", preparePrice(extremesToday.minVal/1000));
await publishDevice("Lowest upcomping spot price today time", baseEntity + "_today_min_time", extremesToday.minTime.toISOString());
await publishDevice("Highest upcomping spot price tomorrow", baseEntity + "_tomorrow_max", preparePrice(extremesTomorrow.maxVal/1000));
await publishDevice("Highest upcomping spot price tomorrow time", baseEntity + "_tomorrow_max_time", extremesTomorrow.maxTime.toISOString());
await publishDevice("Lowest upcomping spot price tomorrow", baseEntity + "_tomorrow_min", preparePrice(extremesTomorrow.minVal/1000));
await publishDevice("Lowest upcomping spot price tomorrow time", baseEntity + "_tomorrow_min_time", extremesTomorrow.minTime.toISOString());

await client.disconnect();