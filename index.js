const {ArgumentParser} = require('argparse');
const dotenv = require('dotenv');
const mysqlPromise = require('mysql2/promise');
const fs = require('fs');
const { Toolkit } = require("actions-toolkit");

// const Heroku = require("heroku-client");
// const heroku = new Heroku({ token: process.env.HEROKU_API_TOKEN });

// Will load .env.local if exists, otherwise it will just load .env
// dotenv.config({path: '.env.local'});
// dotenv.config({path: '.env'});

// const parser = new ArgumentParser({
//   description: 'Argparse example'
// });
//
// parser.add_argument('-b', '--branch');
// parser.add_argument('-c', '--ciId');
// parser.add_argument('-d', '--database');
// parser.add_argument('-ha', '--herokuApp');
// parser.add_argument('-o', '--operation');
//
// const args = parser.parse_args();

// const dbUser = process.env.DBUSER;
// const dbPassword = process.env.DBPASSWORD;
// const dbHost = process.env.DBHOST;
// const dbName = process.env.DATABASE;

const dbUser = "set me";
const dbPassword = "set me";
const dbHost = "set me";
const dbName = "set me";

/**
 * Run wrapper method
 */
Toolkit.run(
  async(tools) => {
    let connection = null;
    try {
      // Create a promise capable database connection.
      connection = await mysqlPromise.createConnection({
        host: dbHost,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        connectTimeout: 60000
      });

      tools.log.info('HERE AAA');

      if (args.operation.toUpperCase() === 'INSERT') {
        let insertId = null;
        let status = 'new';
        let herokuAppName = null;
        let readQuery = `SELECT * FROM workflows WHERE branch="${args.branch}"`;

        const [readResponse] = await connection.execute(readQuery);

        if (readResponse.length === 0) {
          console.log('Branch name not found, creating new ci entry.');
          const query =
              `INSERT INTO workflows
       (branch)
       VALUES ("${args.branch}")`;

          const [response] = await connection.execute(query);

          insertId = response.insertId;
        } else {
          insertId = readResponse[0].id;
          herokuAppName = readResponse[0].heroku_app;
          // It's possible that we created the db record but failed prior to
          // deploying heroku.
          if (herokuAppName) {
            status = 'existing';
          }
          console.log(`ci id ${insertId} found for branch ${args.branch}`);
        }

        await fs.writeFile('ci_id.txt', insertId, 'utf8', (err) => {
          if (err) {
            return console.log(err);
          }
        });

        await fs.writeFile('deploy_status.txt', status, 'utf8', (err) => {
          if (err) {
            return console.log(err);
          }
        });

        await fs.writeFile('heroku_app.txt', herokuAppName, 'utf8', (err) => {
          if (err) {
            return console.log(err);
          }
        });
      } else {
        let readQuery = `SELECT * FROM workflows WHERE id=${args.ciId}`;

        const [readResponse] = await connection.execute(readQuery);

        if (readResponse.length === 1) {
          const query =
              `UPDATE workflows 
          SET heroku_app="${args.herokuApp}", database_name="${args.database}"
          WHERE id=${args.ciId}`;

          console.log(query);

          const [updateResponse] = await connection.execute(query);
          console.log(updateResponse);
        } else {
          console.log(`Issue finding workflow ${args.ciId}`);
          throw new Error('invalid update');
        }
      }
      tools.log.success("Action complete");
    } catch (error) {
      console.log(error);
    } finally {
      if (connection) {
        connection.end();
      }
    }
  },
  {
    event: [
      "pull_request.opened",
      "pull_request.reopened",
      "pull_request.synchronize",
      "pull_request.labeled",
      "pull_request.closed",
      "workflow_dispatch"
    ],
    secrets: ["GITHUB_TOKEN"]
  }
);

