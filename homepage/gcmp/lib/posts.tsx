import { Post } from "@/interfaces/blogPost";
import { Author } from "@/interfaces/author";
import Test from "@/components/blog/posts/test.mdx";

const authors = {
    anselm: {
        name: "Anselm Eickhoff",
        picture: "/social-image.png",
    },
};

const posts: Array<Post> = [
    {
        title: "Lorem Ipsum",
        author: authors.anselm,
        slug: "test",
        coverImage: "/social-image.png",
        date: new Date(),
        excerpt:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut gravida vel urna sit amet lacinia. Morbi euismod mi ac lacus feugiat, vel sollicitudin urna faucibus. ",
        content: <Test />,
    },
];

export const getAllPosts = () => {
    return posts;
};

export const getPostBySlug = (slug: string) => {
    return posts.find((post) => post.slug === slug);
};
