import "./tabContent.scss";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";
import { Build, BuildRestClient, Attachment } from "azure-devops-extension-api/Build";
import { Observer } from "azure-devops-ui/Observer";
import { Tab, TabBar, TabSize } from "azure-devops-ui/Tabs";

const ATTACHMENT_TYPE = "report-html";

SDK.init();
SDK.ready().then(() => {
  try {
    const config = SDK.getConfiguration();
    config.onBuildChanged((build: Build) => {
      let buildAttachmentClient = new BuildAttachmentClient(build);
      buildAttachmentClient.init().then(() => {
        displayReports(buildAttachmentClient);
      }).catch(error => { throw new Error(error); });
    });
  } catch (error) {
    throw new Error(error);
  }
});

function displayReports(attachmentClient: AttachmentClient) {
  ReactDOM.render(<TaskAttachmentPanel attachmentClient={attachmentClient} />, document.getElementById("html-report-extension-container"));
}

abstract class AttachmentClient {
  protected attachments: Attachment[] = [];
  protected authHeaders: Object = undefined;

  public getAttachments(): Attachment[] {
    return this.attachments;
  }

  public getDownloadableAttachment(attachmentName: string): Attachment {
    const attachment = this.attachments.find((attachment) => attachment.name === attachmentName);
    if (!attachment?._links?.self?.href) {
      throw new Error("Attachment " + attachmentName + " is not downloadable");
    }
    return attachment;
  }

  public async getAttachmentContent(attachmentName: string): Promise<string> {
    if (this.authHeaders === undefined) {
      const accessToken = await SDK.getAccessToken();
      const b64encodedAuth = btoa(':' + accessToken);
      this.authHeaders = { headers: { 'Authorization': 'Basic ' + b64encodedAuth } };
    }
    const attachment = this.getDownloadableAttachment(attachmentName);
    const response = await fetch(attachment._links.self.href, this.authHeaders);
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    const responseText = await response.text();
    return responseText;
  }
}

class BuildAttachmentClient extends AttachmentClient {
  private readonly build: Build;

  constructor(build: Build) {
    super();
    this.build = build;
  }

  public async init() {
    const buildClient: BuildRestClient = getClient(BuildRestClient);
    this.attachments = await buildClient.getAttachments(this.build.project.id, this.build.id, ATTACHMENT_TYPE);
  }
}

interface TaskAttachmentPanelProps {
  attachmentClient: AttachmentClient;
}

interface AttachmentMetadata {
  displayName: string;
  stageName: string;
  stageAttempt: number;
  allowUnsafeScripts: boolean;
}

interface TaskAttachmentPanelState {
  selectedTabId: string;
  tabContents: Map<string, string>;
}

export default class TaskAttachmentPanel extends React.Component<TaskAttachmentPanelProps, TaskAttachmentPanelState> {

  constructor(props: TaskAttachmentPanelProps) {
    super(props);
    this.state = {
      selectedTabId: props.attachmentClient.getAttachments()[0]?.name || "",
      tabContents: new Map<string, string>()
    };
  }

  componentDidMount() {
    const { attachmentClient } = this.props;
    const attachments = attachmentClient.getAttachments();
    attachments.forEach(attachment => {
        if (!this.state.tabContents.has(attachment.name)) {
            this.fetchContent(attachment.name);
        }
    });
}

  fetchContent = (attachmentName: string) => {
    if (this.state.tabContents.has(attachmentName)) {
        return;
    }
    this.props.attachmentClient.getAttachmentContent(attachmentName).then((content) => {
        this.setState(prevState => {
            const tabContents = new Map(prevState.tabContents);
            tabContents.set(attachmentName, content);

            return { tabContents };
        });
    }).catch(error => {
        console.error("Failed to fetch content for: ", attachmentName, error);
    });
  };

  parseAttachmentMetadata(attachmentName: string): AttachmentMetadata {
    const metadata = attachmentName.split('~');
    const stageAttempt = Number.parseInt(metadata[3]);

    return {
      displayName: metadata[0] || attachmentName,
      stageName: metadata[2] || "",
      stageAttempt: Number.isNaN(stageAttempt) ? 0 : stageAttempt,
      allowUnsafeScripts: metadata[5] === "allow-scripts"
    };
  }

  renderReportFrame(content?: string, allowUnsafeScripts?: boolean) {
    if (!content) {
      return <div className="wide"><p>Loading...</p></div>;
    }

    return (
      <div className="report-frame-container">
        {allowUnsafeScripts ? (
          <div className="report-warning">
            Scripts were explicitly enabled for this report. Only use this mode for trusted HTML content.
          </div>
        ) : null}
        <iframe
          className={`report-frame tab-content flex-row flex-center${allowUnsafeScripts ? " report-frame--with-warning" : ""}`}
          sandbox={allowUnsafeScripts ? "allow-scripts" : ""}
          referrerPolicy="no-referrer"
          srcDoc={content}
          title="HTML report"
        />
      </div>
    );
  }

  render() {
    const { selectedTabId, tabContents } = this.state;
    const attachments = this.props.attachmentClient.getAttachments();

    if (attachments.length === 0) {
        return null;
    }

    const containerClass = "wide"

    return (
        <div className={containerClass}>
            {attachments.length > 1 ? (
                <>
                    <TabBar
                        onSelectedTabChanged={newTabId => this.setState({ selectedTabId: newTabId })}
                        selectedTabId={selectedTabId}
                        tabSize={TabSize.Tall}
                    >
                        {attachments.map(attachment => {
                            const metadata = this.parseAttachmentMetadata(attachment.name);
                            let name = metadata.displayName;
                            let badgeCount = undefined;
                            if (metadata.stageName !== '__default' && metadata.stageAttempt > 1) {
                              badgeCount = metadata.stageAttempt;
                            }
                            return (
                                <Tab
                                    name={name}
                                    id={attachment.name}
                                    key={attachment.name}
                                    url={attachment._links.self.href}
                                    badgeCount={badgeCount}
                                />
                            );
                        })}
                    </TabBar>
                    <Observer selectedTabId={selectedTabId} tabContents={tabContents}>
                        {(props: { selectedTabId: string }) => {
                        return this.renderReportFrame(
                          tabContents.get(props.selectedTabId),
                          this.parseAttachmentMetadata(props.selectedTabId).allowUnsafeScripts
                        );
                        }}
                    </Observer>
                </>
            ) : (
                  this.renderReportFrame(
                    tabContents.get(attachments[0].name),
                    this.parseAttachmentMetadata(attachments[0].name).allowUnsafeScripts
                  )
            )}
        </div>
    );
  }

}
