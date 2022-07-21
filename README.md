# Google Calendar Daily Notion Integration

This simple integration for a Notion app will read your Google Calendar and update a Notion database.

## Configuration

Create a Google Cloud App and initialize the Google Calendar API. Create and download OAuth2 Credentials and place that file in `credentials.json`. This should contain something similar to below (with your keys of course):

```json
{
    "installed": {
        "client_id": "2348192384912345-139r284fh2789fj2389fjf.apps.googleusercontent.com",
        "project_id": "name-of-project",
        // ...
    }
}
```

Additionally, you will need to create an `exclude.json` file with the names of the calendars you do NOT want to see. Each entry should be the **full display name** of the calendar that shows up on [Google Calendar](https://calendar.google.com/)

```json
{
    "exclude": [
        "First calendar to exclude",
        "Second calendar to exclude",
        // ...
    ]
}
```

Finally, we will need a `.env` file for Notion access. Create a [Notion Integration](https://developers.notion.com/) and copy the required information below. To find the ID of your database, refer to [the docs](https://developers.notion.com/docs/working-with-databases):

```
TIMEZONE=America/Chicago (change to your timezone)
NOTION_TOKEN=[whatever your integration token is]
NOTION_DB_ID=[ID of the database]
```

## Notion Setup

The integration will only work with ONE database, so you simply need to create a database with the following properties:

* Name [Title] - Default title
* Display Date [Text] - Date to diplay in the list view (just has the times)
* Date [Date] - Date object with start/end times for sorting
* Location [Text] - Location of the event
* Description [Text] - Description of the event
* Link [Text] - Link to the Google Calendar event
* All Day [Checkbox] - Checkbox for sorting all day events to the top

Make sure all properties are spelled correctly and have the correct types or the function **will not work**!

## Build

You must have [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html) installed. To build the app, configure all above correctly and run `sam build`. To copy over the required JSON files, run `yarn postbuild`. Then, you can deploy the lambda function with `sam deploy`.
