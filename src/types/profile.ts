type ProfileLink = {
  key: string;
  value: string;
};

export type EnsProfile = {
  name: string;
  url?: string;
  avatar?: string;
  description?: string;
  links?: ProfileLink[];
};
