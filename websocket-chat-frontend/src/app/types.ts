export type Message = {
  id: string | number;
  from: string;
  to: string;
  content: string;
  type: string;
};

export type Contact = {
  username: string;
  avatar?: string;
};
