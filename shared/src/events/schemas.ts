import { Message, User } from '../types';

export enum EventType {
  USER_REGISTERED = 'USER_REGISTERED',
  USER_LOGGED_IN = 'USER_LOGGED_IN',
  MESSAGE_SENT = 'MESSAGE_SENT',
  MESSAGE_DELETED = 'MESSAGE_DELETED',
  TENANT_CREATED = 'TENANT_CREATED',
  ENROLLMENT_COMPLETED = 'ENROLLMENT_COMPLETED'
}

export interface BaseEvent {
  eventId: string;
  timestamp: Date;
  tenantId: string;
}

export interface UserRegisteredEvent extends BaseEvent {
  type: EventType.USER_REGISTERED;
  payload: {
    user: User;
    academicInfo: {
      facultyId?: string;
      departmentId?: string;
      cohortId?: string;
    };
  };
}

export interface MessageSentEvent extends BaseEvent {
  type: EventType.MESSAGE_SENT;
  payload: {
    message: Message;
  };
}

// Union type for all events
export type UniChatEvent =
  | UserRegisteredEvent
  | MessageSentEvent;
