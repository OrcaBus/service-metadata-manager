# Event Schemas

## Overview

This directory contains JSON schema definitions for all events published by the Metadata Manager service to the OrcaBus event bus. These events are emitted when metadata records (subjects, samples, libraries, etc.) are created, updated, or deleted.

## Event Types

Each event type is documented in its own subdirectory:

- **[`MetadataStateChange`](./MetadataStateChange/)** - Emitted when metadata records are created, updated, or deleted

## Implementation

The **implementation** of these events, including Pydantic models for validation and serialization, is located in the core application:

📁 **Location:** [`metadata-manager/app/schema/events/`](../../metadata-manager/app/schema/events/)

The Pydantic models provide type safety and automatic validation when creating or consuming events.

## Testing

Event examples are validated against their schemas as part of the schema directory within the app.

🧪 Run `make test` in the [`event schema directory`](../../metadata-manager/app/schema/events/).

## Usage

### For Event Publishers

Events are automatically published by the Metadata Manager service when records are modified.

📚 See the [Metadata Manager README](../../metadata-manager/README.md) for implementation details.

### For Event Consumers

Consumers can subscribe to these events through AWS EventBridge rules configured in their respective applications.

📖 Refer to your consuming application's EventBridge rule configuration for subscription details.
