import './core/Command';
import './session/SessionManager';
import './session/SyncSchedulers';

import { InvseeEvents } from './core/Events';
InvseeEvents.install();

import { init } from '@bedrock-oss/stylish';
init();

import { Logger, LogLevel } from '@bedrock-oss/bedrock-boost';
Logger.setLevel(LogLevel.Info);
Logger.setBasicTimestampFormatter();
