import {InitModelOf, Outline} from '@eclipse-scout/core';
import {ConversationTablePage} from './ConversationTablePage';
import {ContactTablePage} from './ContactTablePage';
import {SearchTablePage} from './SearchTablePage';

/**
 * The single outline of the ScoutKit desktop. It provides the navigation tree with three top-level
 * pages — {@link ConversationTablePage}, {@link ContactTablePage} and {@link SearchTablePage} —
 * each of which drills down to a chat conversation in the bench. The pages are created from models
 * here so the framework wires their parent to this outline.
 */
export class WorkspaceOutline extends Outline {

  protected override _init(model: InitModelOf<this>): void {
    model.title = model.title ?? '${textKey:scoutkit.Workspace}';
    model.nodes = model.nodes ?? [
      {objectType: ConversationTablePage, text: '${textKey:scoutkit.Conversations}'},
      {objectType: ContactTablePage, text: '${textKey:scoutkit.Contacts}'},
      {objectType: SearchTablePage, text: '${textKey:Search}'}
    ];
    super._init(model);
  }
}
