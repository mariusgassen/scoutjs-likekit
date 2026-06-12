import {Button, Form, FormModel, GroupBox, InitModelOf, scout, StringField, WidgetField} from '@eclipse-scout/core';
import {LiveKitMeeting} from '@bsi/scout-livekit';

/**
 * Demo form: enter a room + display name, then Start/Join hosts a {@link LiveKitMeeting}
 * widget in the lower {@link WidgetField}.
 */
export class MeetingForm extends Form {

  protected override _jsonModel(): FormModel {
    return {
      title: 'LiveKit Meeting',
      rootGroupBox: {
        objectType: GroupBox,
        gridColumnCount: 1,
        fields: [
          {
            id: 'ConnectBox',
            objectType: GroupBox,
            gridColumnCount: 3,
            labelVisible: false,
            borderVisible: false,
            fields: [
              {
                id: 'RoomField',
                objectType: StringField,
                label: 'Room',
                mandatory: true
              },
              {
                id: 'NameField',
                objectType: StringField,
                label: 'Your name',
                mandatory: true
              },
              {
                id: 'JoinButton',
                objectType: Button,
                label: 'Start / Join',
                processButton: false
              }
            ]
          },
          {
            id: 'MeetingField',
            objectType: WidgetField,
            labelVisible: false,
            statusVisible: false,
            gridDataHints: {
              h: 12,
              weightY: 1,
              fillVertical: true
            }
          }
        ]
      }
    };
  }

  protected override _init(model: InitModelOf<this>): void {
    super._init(model);
    this.widget('JoinButton', Button).on('click', this._onJoinClick.bind(this));
  }

  protected _onJoinClick(): void {
    const room = this.widget('RoomField', StringField).value;
    const name = this.widget('NameField', StringField).value;
    if (!room || !name) {
      return;
    }

    const meetingField = this.widget('MeetingField', WidgetField);
    if (meetingField.fieldWidget) {
      meetingField.fieldWidget.destroy();
    }

    const meeting = scout.create(LiveKitMeeting, {
      parent: meetingField,
      serverUrl: window.APP_CONFIG?.livekitUrl || 'ws://localhost:7880',
      tokenUrl: '/api/token',
      room,
      identity: `${name}-${Math.random().toString(36).slice(2, 8)}`,
      displayName: name,
      autoConnect: true
    });
    meetingField.setFieldWidget(meeting);
  }
}
