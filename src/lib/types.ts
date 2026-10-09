export interface Seo {
  ready:boolean; generatedAt?:string; title?:string; description?:string; canonical?:string;
  robots?:string[]; openGraphTitle?:string; openGraphDescription?:string; openGraphImage?:string;
  openGraphUrl?:string; openGraphType?:string; openGraphSiteName?:string;
  twitterCard?:string; twitterTitle?:string; twitterDescription?:string; twitterImage?:string; jsonLd?:string;
}
export interface Connection<T> { nodes:T[]; pageInfo:{hasNextPage:boolean;endCursor:string|null} }
export interface Node {
  __typename:string; id?:string; databaseId?:number; uri?:string; title?:string; name?:string;
  content?:string; description?:string; excerpt?:string; status?:string; isRestricted?:boolean; hasPassword?:boolean;
  date?:string; modified?:string; readyspaceSeo?:Seo;
  author?:{node:{name:string;uri:string}};
  featuredImage?:{node:{sourceUrl:string;altText:string;mediaDetails?:{width:number;height:number}}};
  categories?:{nodes:{name:string;uri:string}[]}; tags?:{nodes:{name:string;uri:string}[]};
  posts?:Connection<Node>;
}
