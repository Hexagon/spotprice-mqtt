import { spotprice } from "https://deno.land/x/spotprice@0.0.3/dist/spotprice.min.mjs";
import { Client } from 'https://deno.land/x/mqtt@0.1.2/deno/mod.ts';
import { config } from './config.js';
import { logger, logAndExit } from "./logger.js";
import { findPriceAt, findMinMaxPriceAtDate } from "./filters.js";

// Some nice constants!
const
    oneHourMs = 3600*1000,
    oneDayMs = oneHourMs*24;

// Start by checking that MQTT service is available
let client;
try {
    // Start timeout timer
    const connectionTimeout = setTimeout(() => { 
        if(connectionTimeout) {
            logger("Connection timed out");
            Deno.exit(1);
        }
    }, config.connectionTimeoutMs);

    // Try to connect
    client = new Client({ url: `mqtt://${config.host}:${config.port}` });
    await client.connect();

    // If we got here, all is good, clear timeout timer
    clearTimeout(connectionTimeout);
} catch (e) {

    // Oh cra...
    logAndExit("failed to connect " + e.toString(), 1);
}

// Fetch the data
let result;
try {
    result = [
        ...await spotprice("hourly", config.area, config.currency, new Date(new Date().getTime()-oneDayMs)),
        ...await spotprice("hourly", config.area, config.currency, new Date()),
        ...await spotprice("hourly", config.area, config.currency, new Date(new Date().getTime()+oneDayMs)),
    ];
} catch (e) {
    logAndExit("failed to fetch " + e.toString(), 1);
}

async function publishDevice(name, id, state, type) {
    if (type !== "json") {
        logger("publishing " + name + " " + state);
    } else {
        logger("publishing " + name + " [json]");
    }
    let
        stateTopic = config.topic + id + "/state",
        attributesTopic = config.topic + id + "/attributes",
        configTopic = config.topic + id + "/config",
        deviceConfig;
    if (type === "monetary") {
        deviceConfig = {
            device_class: "monetary",
            name: name,
            state_topic: stateTopic,
            unit_of_measurement: config.currency + "/kWh",
            object_id: id
        };
    } else if (type === "json" ) {
        deviceConfig = {
            name: name,
            state_topic: stateTopic,
            json_attributes_topic: attributesTopic,
            object_id: id
        };
    } else {
        deviceConfig = {
            name: name,
            state_topic: stateTopic,
            object_id: id
        };
    }
    try {
        await client.publish(configTopic, JSON.stringify(deviceConfig)); 
        if(type=="json") {
            await client.publish(stateTopic, "");
            await client.publish(attributesTopic, state);
        } else {
            await client.publish(stateTopic, state);
        }
        await client.publish(stateTopic, state);
    } catch (e) {
        logger("failed to publish " + e.toString());
        Deno.exit(1)
    }
}

// Generate a Date which represents 00:00:01 tomorrow
const dateTomorrow = new Date(new Date().getTime()+oneDayMs);
dateTomorrow.setHours(0);
dateTomorrow.setMinutes(0);
dateTomorrow.setSeconds(1);

// Find extremes in result set
const
    extremesToday = findMinMaxPriceAtDate(result, new Date()),
    extremesTomorrow = findMinMaxPriceAtDate(result, dateTomorrow);

// Convenience function which applies extra costs to the spotprice
function preparePrice(price) {
    if (price !== null) {
        // Add price first - befora applying the price factor
        price = ( (price / 1000) + config.extra) * config.factor;

        // ... Allow reducing the number of decials
        return price ? price.toFixed(config.decimals) : "";
    } else {
        return "";
    }
}

// Ok, ready to publish
await publishDevice("Spot price now", config.entity + "_now", preparePrice(findPriceAt(result, new Date())), "monetary");
await publishDevice("Spot price in 1 hour", config.entity + "_1h", preparePrice(findPriceAt(result, new Date(new Date().getTime()+oneHourMs))), "monetary");
await publishDevice("Spot price in 6 hours", config.entity + "_6h", preparePrice(findPriceAt(result, new Date(new Date().getTime()+oneHourMs*6))), "monetary");
await publishDevice("Spot price in 12 hours", config.entity + "_12h", preparePrice(findPriceAt(result, new Date(new Date().getTime()+oneHourMs*12))), "monetary");
await publishDevice("Highest upcomping spot price today ", config.entity + "_today_max", preparePrice(extremesToday.maxVal), "monetary");
await publishDevice("Highest upcomping spot price today time", config.entity + "_today_max_time", extremesToday.maxTime, "datetime");
await publishDevice("Lowest upcomping spot price today", config.entity + "_today_min", preparePrice(extremesToday.minVal), "monetary");
await publishDevice("Lowest upcomping spot price today time", config.entity + "_today_min_time", extremesToday.minTime, "datetime");
await publishDevice("Highest upcomping spot price tomorrow", config.entity + "_tomorrow_max", preparePrice(extremesTomorrow.maxVal), "monetary");
await publishDevice("Highest upcomping spot price tomorrow time", config.entity + "_tomorrow_max_time", extremesTomorrow.maxTime, "datetime");
await publishDevice("Lowest upcomping spot price tomorrow", config.entity + "_tomorrow_min", preparePrice(extremesTomorrow.minVal), "monetary");
await publishDevice("Lowest upcomping spot price tomorrow time", config.entity + "_tomorrow_min_time", extremesTomorrow.minTime, "datetime");
await publishDevice("Spot price data", config.entity + "_data", JSON.stringify({ history: result.map(r=>{ return {st:r.startTime,p:preparePrice(r.spotPrice)};}) }), "json");

await client.disconnect();