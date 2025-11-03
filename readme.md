# 🎬 Web Teleprompter

A professional web-based teleprompter with a real-time administration interface and REST API.

## Features

-   **Real-time Updates:** Text, speed, and display settings are updated in real-time on all connected prompter screens.
-   **Markdown Support:** Write and format your scripts using Markdown.
-   **Playback Control:** Play, pause, reset, and manually scroll the text.
-   **Adjustable Speed:** Control the scrolling speed to match your speaking pace.
-   **Display Modes:**
    -   **Mirror Mode:** Flips the text horizontally for use with physical teleprompter mirrors.
    -   **Invert Mode:** Inverts the screen colors (white text on black background) for better readability.
-   **Webcam Overlay:** Overlay a live webcam feed on the prompter screen, with adjustable opacity and blur.
-   **Import/Export:** Import and export your scripts as Markdown files.
-   **Persistent Text:** The script is automatically saved in your browser's local storage.

## Tech Stack

-   **Backend:** Node.js, Express, WebSocket
-   **Frontend:** HTML, CSS, JavaScript (no frameworks)

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v14 or later)
-   [npm](https://www.npmjs.com/)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/web-teleprompter.git
    cd web-teleprompter
    ```

2.  Install the server dependencies:
    ```bash
    cd server
    npm install
    ```

### Running the Application

1.  Start the server from the `server` directory:
    ```bash
    npm start
    ```

2.  The server will start on `http://localhost:3000`. You will see the following output in your terminal:

    ```
    🚀 Server started on http://localhost:3000
    📝 Admin Interface: http://localhost:3000/
    📺 Prompter: http://localhost:3000/prompter.html
    ```

## Usage

1.  **Admin Interface:**
    -   Open `http://localhost:3000/` in your web browser.
    -   Here you can write or import your script, control the playback, and adjust the settings.

2.  **Prompter Screen:**
    -   Click the "Open Prompter" button in the admin interface, or directly open `http://localhost:3000/prompter.html` in a new window or on a separate device.
    -   The prompter screen will display the text and update in real-time as you make changes in the admin interface.
