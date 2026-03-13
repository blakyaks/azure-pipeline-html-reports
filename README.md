# Html Reports (blakyaks.azure-pipeline-html-reports)

An Azure DevOps extension that provides a task for publishing HTML formatted reports onto build and release pages.

## Using the extension

In order to see a report tab you must use the  `Publish HTML Report` task. This is a supporting task which adds HTML output from the build pipeline(s) for viewing.

- The task takes one mandatory parameter `reportDir` which should reference the HTML filename or directory to be published. The optional `tabName` parameter may also be supplied to configure the name of the tab displayed under `Reports` in the Azure DevOps UI.

- Report tab names will use the filename rather than the `tabName` when a directory path has been provided for the `reportDir` parameter. This is the default behaviour and must be overridden by setting `useFilenameTabs` parameter is set to `false`.

### Example YAML use

```YAML
steps:
  - task: PublishHtmlReport@1
    displayName: 'Publish HTML Report'
    inputs:
      reportDir: '$(ResultsPath)/reportName.html'
      useFilenameTabs: true
      allowUnsafeScripts: false
      tabName: MyReport
```

## Limitations and known issues

### HTML file compatibility

Due to the way this extension works, we recommend that any HTML files published operate as entirely self-contained, single page reports. External links or style sheets that are embedded in HTML files may not function within the Azure DevOps UI due to CORS restrictions. It is also not possible to use relative links in HTML reports that are published via the extension since these will not resolve to the build artifacts in Azure DevOps. Anchor links should work as expected.

For security reasons, published reports are rendered in a sandboxed iframe. This removes the need for elevated build execution scope in the extension manifest and prevents active script content from escaping the report surface. Reports that depend on embedded JavaScript may no longer behave as fully interactive pages and should be exported as static self-contained HTML where possible.

If you need to preserve client-side report behavior, set `allowUnsafeScripts: true` on the task. This still keeps the report in a sandboxed iframe, but it permits embedded JavaScript to run inside the report. Use it only for trusted report generators.

### Large HTML reports

Very large reports (e.g. greater than 50MB) may cause the task to exhaust the default Node memory allocation (as per this reported [issue](https://github.com/blakyaks/azure-pipeline-html-reports/issues/13)), leading to the task failing and not uploading the report as an attachment. In order to work around this issue it may be necessary to add an additional step in your pipelines before the publish task is executed:

```yaml
- powershell: |
    # Set the NODE_OPTIONS environment variable
    echo "##vso[task.setvariable variable=NODE_OPTIONS]--max-old-space-size=8192"
  displayName: 'Set NODE_OPTIONS Environment Variable'
```

Note that large reports will also take an extended time to load in the UI and should be avoided where possible by breaking down the reports into smaller units.

## Changelog

### v1.3.1

- Reduced extension scope from build execute to build read for loading report attachments
- Reports now render in sandboxed iframes by default to prevent HTML content from escaping the report surface
- Added `allowUnsafeScripts` as an explicit opt-in for trusted interactive reports that require embedded JavaScript

### v1.3.0

- Addresses multiple CSS issues including [this](https://github.com/blakyaks/azure-pipeline-html-reports/issues/15) reported issue
- Added functionality as per this [feature request](https://github.com/blakyaks/azure-pipeline-html-reports/issues/14) so that the tabs are not shown in the UI when only one report is provided
- Updates task so that upper cased HTML/HTM files will also be imported if present

### v1.2.1

- Added support for setting tab names automatically based on filename when scanning directories for reports as per this [feature request](https://github.com/blakyaks/azure-pipeline-html-reports/issues/4)
- Removed the stage attempt badge for initial job runs

### v1.2.0

- Addresses this [issue](https://github.com/blakyaks/azure-pipeline-html-reports/issues/2) which was carried over from the original source project. The `reportDir` property now supports both directory and file paths; if a directory is specified, all `*.html` and `*.htm` files in that directory will be displayed. An example is shown below:

```yaml
- task: PublishHtmlReport@1
  displayName: Publish Directory Reports
  condition: succeededOrFailed()
  inputs:
    reportDir: 'cypress/reports'
    allowUnsafeScripts: true
    tabName: 'E2E ${{ parameters.region }}-${{ parameters.slotName }}'
```

### v1.1.1

This version patches the [AwardedSolutions](https://github.com/FreakinWard/azure-pipeline-html-report) release and is now maintained for future support purposes. The BlakYaks release supports Node 16 and Node 20 runners, removing the deprecation notice displayed during pipeline runs.

Task names and inputs were maintained to simplify update from previous releases.

```yaml
- task: PublishHtmlReport@1
  displayName: Publish E2E Test Report
  condition: succeededOrFailed()
  inputs:
    reportDir: 'cypress/reports/index.html'
    allowUnsafeScripts: true
    tabName: 'E2E ${{ parameters.region }}-${{ parameters.slotName }}'
```
