import {Form, FormModel, GroupBox, WidgetField} from '@eclipse-scout/core';
import {ChatWorkspace} from './ChatWorkspace';

/**
 * Full-bench host form for the {@link ChatWorkspace}. The form has no chrome of its own; it just
 * fills the desktop bench with the Teams/Slack-like workspace widget.
 */
export class MainForm extends Form {

  protected override _jsonModel(): FormModel {
    return {
      title: 'Scout Meet',
      rootGroupBox: {
        objectType: GroupBox,
        gridColumnCount: 1,
        cssClass: 'cw-root-box',
        borderVisible: false,
        fields: [
          {
            id: 'WorkspaceField',
            objectType: WidgetField,
            labelVisible: false,
            statusVisible: false,
            gridDataHints: {
              h: 12,
              weightY: 1,
              fillVertical: true,
              fillHorizontal: true
            },
            fieldWidget: {
              objectType: ChatWorkspace
            }
          }
        ]
      }
    };
  }
}
