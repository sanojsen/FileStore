# File Creation Date Extraction System

This document explains how the FileStores application extracts and uses creation dates for different file types.

## Overview

The system intelligently determines the `createdAt` date for uploaded files using a priority-based approach that considers the actual content creation date rather than just the upload time.

## Priority System

The date extraction follows this priority order:

### 1. 🏆 **Content Metadata** (Highest Priority)
- **Photos**: EXIF `DateTimeOriginal` (when photo was taken)
- **Videos**: Video metadata creation date (including iOS/Android formats)
- **PDFs**: PDF creation date from document properties
- **Office Documents**: Document properties creation date
- **Text Files**: Embedded timestamps in comments/headers

### 2. 📁 **File System Metadata** (Medium Priority)
- File modification/creation date from the user's device
- Extracted from `File.lastModified` property in browser

### 3. ⏰ **Upload Time** (Fallback)
- Current server time when file is uploaded
- Used only when no other date sources are available

## Supported File Types

### Images
- **Extraction Method**: EXIF metadata
- **Date Fields**: `DateTimeOriginal`, `DateTime`, `CreateDate`
- **Example**: A photo taken on July 15, 2023 will have `createdAt: 2023-07-15T14:30:25Z`

### Videos
- **Extraction Method**: Video metadata (QuickTime, MP4, etc.)
- **Date Fields**: 
  - `CreationDate`
  - `MediaCreateDate`
  - `com.apple.quicktime.creationdate` (iOS)
  - `com.apple.quicktime.location.date` (iOS with location)
- **Example**: iPhone video recorded on Aug 10, 2023 uses QuickTime creation date

### PDF Documents
- **Extraction Method**: PDF metadata parsing
- **Date Fields**: `/CreationDate` in PDF header
- **Format**: PDF date format `D:YYYYMMDDHHMMSS`
- **Example**: PDF created on Dec 25, 2023 at 9:30 AM

### Microsoft Office Documents
- **Extraction Method**: Document properties parsing
- **Date Fields**: 
  - `<dcterms:created>`
  - `<meta name="created" content="...">`
  - `<o:Created>`
- **Formats**: Word, Excel, PowerPoint documents

### Archive Files (ZIP, RAR, TAR)
- **Extraction Method**: Archive header parsing
- **ZIP Files**: Reads DOS timestamp from first file entry
- **Date Fields**: Modification time of oldest file in archive
- **Example**: ZIP file's oldest contained file date

### Text Files & Source Code
- **Extraction Method**: Content pattern matching
- **Patterns Detected**:
  ```
  Created: 2023-12-25
  Date: 2024/01/15
  Generated: 2023-08-20
  @created 2023-07-10
  "created": "2023-12-25T09:30:00Z"
  ```

## Implementation Details

### API Endpoints

#### `/api/upload/extract-metadata`
- Extracts metadata from file content
- Returns `dateTime.taken` field with creation date
- Handles multiple file types and date formats

#### `/api/upload/complete`
- Uses extracted metadata to set `createdAt` field
- Implements priority-based date selection
- Logs which date source was used for debugging

### Database Storage

```javascript
{
  createdAt: Date,      // Actual content creation date
  uploadedAt: Date,     // When file was uploaded to server
  metadata: {
    dateSource: String, // Source of createdAt date (for debugging)
    // ... other metadata
  }
}
```

### Logging

The system logs which date source is used:
- `📅 Using exif-photo date for image.jpg: 2023-07-15T14:30:25.000Z`
- `📁 Using file system date for document.pdf: 2023-12-25T09:30:00.000Z`
- `⏰ Using upload time for unknown.bin: 2024-08-26T12:00:00.000Z`

## Benefits

1. **Accurate Timeline**: Files are organized by actual creation date
2. **Smart Fallbacks**: Always provides a meaningful date
3. **Multi-Format Support**: Handles various file types intelligently
4. **Debugging**: Clear logging of date source selection
5. **Performance**: Lightweight extraction without heavy processing

## Examples

### Photo Upload
```
Original file: IMG_2023_0715_143025.jpg
EXIF DateTimeOriginal: 2023-07-15T14:30:25Z
File modified: 2024-01-01T10:00:00Z
Upload time: 2024-08-26T12:00:00Z

Result: createdAt = 2023-07-15T14:30:25Z (from EXIF)
```

### PDF Document
```
Original file: report.pdf
PDF Creation Date: 2023-12-25T09:30:00Z
File modified: 2024-01-15T08:00:00Z
Upload time: 2024-08-26T12:00:00Z

Result: createdAt = 2023-12-25T09:30:00Z (from PDF metadata)
```

### Unknown File Type
```
Original file: data.bin
File modified: 2024-06-15T16:45:00Z
Upload time: 2024-08-26T12:00:00Z

Result: createdAt = 2024-06-15T16:45:00Z (from file system)
```

This system ensures that your files are properly organized by their actual creation date, providing a much more meaningful and accurate timeline in your file storage system.
