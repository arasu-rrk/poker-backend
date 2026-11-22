export type RealtimeServerMessage =
  | {
      type: "connection.ready";
    }
  | {
      type: "error";
      code: string;
      message: string;
    };
