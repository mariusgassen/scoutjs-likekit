import {Button, Form, FormModel, GroupBox, InitModelOf, StringField} from '@eclipse-scout/core';

export interface SearchQueryFormModel extends FormModel {
  /** Pre-fill the search field (the page's current query). */
  query?: string;
}

/**
 * Small modal dialog to enter a full-text search query. On OK the trimmed {@link query} is exposed
 * so the opener (the {@link SearchTablePage}) can run the search and reload its result table.
 */
export class SearchQueryForm extends Form {
  declare model: SearchQueryFormModel;

  query!: string;

  protected override _jsonModel(): FormModel {
    return {
      title: 'Search messages',
      displayHint: Form.DisplayHint.DIALOG,
      modal: true,
      rootGroupBox: {
        objectType: GroupBox,
        gridColumnCount: 1,
        fields: [
          {
            id: 'query',
            objectType: StringField,
            label: 'Query',
            labelVisible: false,
            // PostgreSQL websearch syntax: "quoted phrase", -excluded, OR.
            placeholder: 'Search all conversations… (e.g. budget OR roadmap, "kick off", -draft)'
          },
          {
            id: 'ok',
            objectType: Button,
            label: 'Search',
            systemType: Button.SystemType.OK,
            processButton: true,
            keyStroke: 'enter'
          },
          {
            id: 'cancel',
            objectType: Button,
            label: 'Cancel',
            systemType: Button.SystemType.CANCEL,
            processButton: true
          }
        ]
      }
    };
  }

  protected override _init(model: InitModelOf<this>): void {
    super._init(model);
    if (this.query) {
      this.widget('query', StringField).setValue(this.query);
    }
  }

  protected override _save(data: any): JQuery.Promise<void> {
    this.query = (this.widget('query', StringField).value || '').trim();
    return super._save(data);
  }
}
