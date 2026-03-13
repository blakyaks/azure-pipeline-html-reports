const tl = require('azure-pipelines-task-lib/task');
const globby = require('globby');
const { readFileSync, writeFileSync, statSync } = require('node:fs');
const { resolve, basename, dirname } = require('node:path');
const cheerio = require('cheerio');
const dashify = require('dashify');

function addTaskAttachment(attachmentProps) {
    tl.addAttachment(attachmentProps.type, attachmentProps.name, attachmentProps.path);
}

function run() {
    try {
        const reportInputPath = tl.getPathInput('reportDir', true, false);
        const allowUnsafeScripts = tl.getBoolInput('allowUnsafeScripts', false);
        const isDir = statSync(reportInputPath).isDirectory();
        let files = [];
        let summaryPath;

        if (isDir) {
            files = globby.sync([`${reportInputPath}/**/*.{html,htm,HTML,HTM}`]); // Find all HTML files within the directory
            summaryPath = resolve(reportInputPath, 'summary.json'); // Place summary in the directory
        } else {
            files = [reportInputPath]; // Single file case
            summaryPath = resolve(dirname(reportInputPath), 'summary.json'); // Place summary in the directory containing the file
        }

        const fileProperties = [];
        const summaryProperties = {
            name: generateSummaryName(),
            type: 'report-html-summary',
            path: summaryPath
        };

        files.forEach(file => {
            tl.debug(`Reading report ${file}`);
            const fileContent = readFileSync(file, 'utf8');
            const document = cheerio.load(fileContent);
            writeFileSync(file, document.html());

            const attachmentProperties = {
                name: generateAttachmentName(basename(file), isDir, allowUnsafeScripts),
                type: 'report-html',
                path: file
            };

            fileProperties.push(attachmentProperties);
            addTaskAttachment(attachmentProperties);
        });

        // Save the summary file
        writeFileSync(summaryPath, JSON.stringify(fileProperties));
        addTaskAttachment(summaryProperties);
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error.message);
    }
}

function generateAttachmentName(fileName, isDirectory, allowUnsafeScripts) {
    const jobName = dashify(tl.getVariable('Agent.JobName'));
    const stageName = dashify(tl.getVariable('System.StageDisplayName'));
    const stageAttempt = tl.getVariable('System.StageAttempt');
    const useFilenamesAsTabHeaders = tl.getBoolInput('useFilenameTabs', true);
    const renderingMode = allowUnsafeScripts ? 'allow-scripts' : 'sandboxed';
    let tabName;
    if (isDirectory && useFilenamesAsTabHeaders) {
        tabName = basename(fileName)
    } else {
        tabName = tl.getInput('tabName', false) || 'Html-Report';
    }

    return `${tabName}~${jobName}~${stageName}~${stageAttempt}~${fileName}~${renderingMode}`;
}

function generateSummaryName() {
    const jobName = dashify(tl.getVariable('Agent.JobName'));
    const stageName = dashify(tl.getVariable('System.StageDisplayName'));
    const stageAttempt = tl.getVariable('System.StageAttempt');
    const tabName = tl.getInput('tabName', false) || 'Html-Report';
    return `${tabName}~${jobName}~${stageName}~${stageAttempt}`;
}

run();