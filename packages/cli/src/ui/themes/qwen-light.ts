/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { lightSemanticColors } from './semantic-tokens.js';

const qwenLightColors: ColorsTheme = {
  type: 'light',
  Background: '#FFFFFF',
  Foreground: '#000000',
  LightBlue: '#FFD900',
  AccentBlue: '#FFD900',
  AccentPurple: '#FFD900',
  AccentCyan: '#FFD900',
  AccentGreen: '#4CAF50',
  AccentYellow: '#FFD900',
  AccentRed: '#D32F2F',
  DiffAdded: '#E8F5E9',
  DiffRemoved: '#FFEBEE',
  Comment: '#4B5563',
  Gray: '#9CA3AF',
  GradientColors: ['#FFD900', '#FFD900'],
};

export const QwenLight: Theme = new Theme(
  'Null Light',
  'light',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: qwenLightColors.Background,
      color: qwenLightColors.Foreground,
    },
    'hljs-comment': {
      color: qwenLightColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: qwenLightColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-string': {
      color: qwenLightColors.AccentGreen,
    },
    'hljs-constant': {
      color: qwenLightColors.AccentCyan,
    },
    'hljs-number': {
      color: qwenLightColors.AccentPurple,
    },
    'hljs-keyword': {
      color: qwenLightColors.AccentYellow,
    },
    'hljs-selector-tag': {
      color: qwenLightColors.AccentYellow,
    },
    'hljs-attribute': {
      color: qwenLightColors.AccentYellow,
    },
    'hljs-variable': {
      color: qwenLightColors.Foreground,
    },
    'hljs-variable.language': {
      color: qwenLightColors.LightBlue,
      fontStyle: 'italic',
    },
    'hljs-title': {
      color: qwenLightColors.AccentBlue,
    },
    'hljs-section': {
      color: qwenLightColors.AccentGreen,
      fontWeight: 'bold',
    },
    'hljs-type': {
      color: qwenLightColors.LightBlue,
    },
    'hljs-class .hljs-title': {
      color: qwenLightColors.AccentBlue,
    },
    'hljs-tag': {
      color: qwenLightColors.LightBlue,
    },
    'hljs-name': {
      color: qwenLightColors.AccentBlue,
    },
    'hljs-builtin-name': {
      color: qwenLightColors.AccentYellow,
    },
    'hljs-meta': {
      color: qwenLightColors.AccentYellow,
    },
    'hljs-symbol': {
      color: qwenLightColors.AccentRed,
    },
    'hljs-bullet': {
      color: qwenLightColors.AccentYellow,
    },
    'hljs-regexp': {
      color: qwenLightColors.AccentCyan,
    },
    'hljs-link': {
      color: qwenLightColors.LightBlue,
    },
    'hljs-deletion': {
      color: qwenLightColors.AccentRed,
    },
    'hljs-addition': {
      color: qwenLightColors.AccentGreen,
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-literal': {
      color: qwenLightColors.AccentCyan,
    },
    'hljs-built_in': {
      color: qwenLightColors.AccentRed,
    },
    'hljs-doctag': {
      color: qwenLightColors.AccentRed,
    },
    'hljs-template-variable': {
      color: qwenLightColors.AccentCyan,
    },
    'hljs-selector-id': {
      color: qwenLightColors.AccentRed,
    },
  },
  qwenLightColors,
  lightSemanticColors,
);
