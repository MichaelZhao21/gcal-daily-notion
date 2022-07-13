'use strict';

const dayjs = require('dayjs');
const fs = require('fs');
const { google } = require('googleapis');
const { Client } = require('@notionhq/client');
require('dotenv').config();

const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin
dayjs.extend(utc);
dayjs.extend(timezone);

const EXCLUDE_PATH = 'exclude.json';
const TOKEN_PATH = 'token.json';

// Initializing a notion client
const notion = new Client({
    auth: process.env.NOTION_TOKEN,
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 * @returns {google.auth.OAuth2} oAuth2 client object
 */
function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    try {
        // Check for tokens or throw an error if they don't exist
        const token = fs.readFileSync(TOKEN_PATH);
        oAuth2Client.setCredentials(JSON.parse(token));
        return oAuth2Client;
    } catch (err) {
        throw new Error(
            'Run yarn auth to authenticate and get refresh tokens locally before deploying function.'
        );
    }
}

/**
 * Pull events from the Google Calendars
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function getEvents(auth) {
    // Read list of excluded calendars
    const excludeRes = fs.readFileSync(EXCLUDE_PATH);
    const exclude = JSON.parse(excludeRes);
    const calendar = google.calendar({ version: 'v3', auth });
    const calRes = await calendar.calendarList.list();
    const filteredCalList = calRes.data.items.filter(
        (item) => exclude.exclude.indexOf(item.summary) === -1
    );

    // Iterate through the list of calendars and make a set of async calls to get all events
    const eventList = await Promise.all(
        filteredCalList.map(async (currCal) => {
            const eventRes = await calendar.events.list({
                calendarId: currCal.id,
                timeMin: dayjs().startOf('day').toISOString(),
                timeMax: dayjs().endOf('day').toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });
            const events = eventRes.data.items;
            return { cal: currCal, events };
        })
    );

    // Create new event objects from the eventList
    const eventObjListList = eventList.map((event) => {
        return event.events.map((e) => ({
            name: e.summary,
            description: e.description,
            location: e.location,
            ...processEventTime(e.start, e.end),
            link: e.htmlLink,
            cal: event.cal.summaryOverride || event.cal.summary,
        }));
    });

    // Flatten object list
    const flatList = eventObjListList.flat();

    // Return list
    console.log('Fetched', flatList.length, 'events at', dayjs().toString());
    return flatList;
}

function processEventTime(start, end) {
    if ('dateTime' in start) {
        const dstart = dayjs(start.dateTime).tz(process.env.TIMEZONE);
        const dend = dayjs(end.dateTime).tz(process.env.TIMEZONE);
        const startsBefore = !dstart.isSame(dayjs(), 'day');
        const endsAfter = !dend.isSame(dayjs(), 'day');

        return {
            allDay: startsBefore && endsAfter,
            startFormatted: dstart.format('h:mma'),
            endFormatted: dend.format('h:mma'),
            start: dstart.toISOString(),
            end: dend.toISOString(),
            startsBefore,
            endsAfter,
        };
    }
    return {
        allDay: true,
        currDate: dayjs().toISOString(),
    };
}

/**
 * Adds the events from Google Calendar to the Notion database
 *
 * @param {object[]} events List of generated events
 */
async function updateNotionDb(events) {
    // Remove all pages from the database
    const res = await notion.databases.query({
        database_id: process.env.NOTION_DB_ID,
        page_size: 100,
    });
    for (let i = 0; i < res.results.length; i++) {
        await notion.blocks.delete({ block_id: res.results[i].id });
    }
    console.log('Deleted', res.results.length, 'previous blocks');

    // Add new events to the database
    for (let i = 0; i < events.length; i++) {
        // Date object, empty if allDay is true
        let dateObj = {
            Date: {
                date: {
                    start: dayjs(events[i].start)
                        .tz(process.env.TIMEZONE)
                        .format('YYYY-MM-DDTHH:mm:ssZ'),
                    end: dayjs(events[i].end)
                        .tz(process.env.TIMEZONE)
                        .format('YYYY-MM-DDTHH:mm:ssZ'),
                },
            },
        };
        if (events[i].allDay) dateObj = {};

        await notion.pages.create({
            parent: {
                type: 'database_id',
                database_id: process.env.NOTION_DB_ID,
            },
            properties: {
                Name: {
                    title: [{ text: { content: events[i].name } }],
                },
                Description: {
                    rich_text: [{ text: { content: events[i].description || '' } }],
                },
                Location: {
                    rich_text: [{ text: { content: events[i].location || '' } }],
                },
                Calendar: {
                    rich_text: [{ text: { content: events[i].cal } }],
                },
                'Display Date': {
                    rich_text: [{ text: { content: formatDueDate(events[i]) } }],
                },
                'All Day': {
                    checkbox: events[i].allDay,
                },
                Link: {
                    url: events[i].link,
                },
                ...dateObj,
            },
        });
        console.log('Added', events[i].name, 'to the database');
    }
}

function formatDueDate(eventObj) {
    // This will also capture the startsBefore AND endsAfter case
    if (eventObj.allDay) return 'All Day';

    if (eventObj.startsBefore) {
        return `Ends ${eventObj.endFormatted}`;
    }

    if (eventObj.endsAfter) {
        return eventObj.startFormatted;
    }

    return `${eventObj.startFormatted} - ${eventObj.endFormatted}`;
}

exports.handler = async (event, context, callback) => {
    try {
        // Load client secrets from a local file.
        const file = fs.readFileSync('credentials.json');

        // Authorize a client with credentials, then call the Google Calendar API.
        const oAuth2Client = authorize(JSON.parse(file));
        const events = await getEvents(oAuth2Client);
        await updateNotionDb(events);
    } catch (err) {
        console.log('Error running function:', err);
    }
    callback(null, 'Finished');
};
