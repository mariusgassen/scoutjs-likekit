import {Button, Form, FormModel, GroupBox, InitModelOf, StringField} from '@eclipse-scout/core';

export interface SearchQueryFormModel extends FormModel {
  /** Pre-fill the search field (the outline's current query). */
  query?: string;
}

/**
 * Small modal dialog to enter a global search query. On OK the trimmed {@link query} is exposed so
 * the opener (the {@link SearchOutline}) can run the search and reload its result pages.
 */
export class SearchQueryForm extends Form {
  declare model: SearchQueryFormModel;

  query!: string;

  protected override _jsonModel(): FormModel {
    return {
      title: '${textKey:scoutkit.SearchMessages}',
      displayHint: Form.DisplayHint.DIALOG,
      modal: true,
      rootGroupBox: {
        objectType: GroupBox,
        gridColumnCount: 1,
        fields: [
          {
            id: 'query',
            objectType: StringField,
            label: '${textKey:scoutkit.Query}',
            labelVisible: false,
            // PostgreSQL websearch syntax: "quoted phrase", -excluded, OR.
            placeholder: '${textKey:scoutkit.SearchPlaceholder}'
          },
          {
            id: 'ok',
            objectType: Button,
            label: '${textKey:Search}',
            systemType: Button.SystemType.OK,
            processButton: true,
            keyStroke: 'enter'
          },
          {
            id: 'cancel',
            objectType: Button,
            label: '${textKey:Cancel}',
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
