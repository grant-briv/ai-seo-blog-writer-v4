
import React, { useState, useEffect } from 'react';
import type { User, SavedBlogPost } from '../types';
import { Button } from './Button';
import { TrashIcon } from './Icons';
import { getSavedBlogsForUser } from '../services/blogStorageService';

interface SavedBlogsManagerProps {
  currentUser: User;
  onLoadBlog: (blog: SavedBlogPost) => void;
  onDeleteBlog: (blogId: string) => void;
}

export const SavedBlogsManager: React.FC<SavedBlogsManagerProps> = ({ currentUser, onLoadBlog, onDeleteBlog }) => {
    const [savedBlogs, setSavedBlogs] = useState<SavedBlogPost[]>([]);

    useEffect(() => {
        setSavedBlogs(getSavedBlogsForUser(currentUser.id));
    }, [currentUser.id]);

    const handleDelete = (blogId: string, blogTitle: string) => {
        if (window.confirm(`Are you sure you want to delete the saved blog "${blogTitle}"? This action cannot be undone.`)) {
            onDeleteBlog(blogId);
            setSavedBlogs(getSavedBlogsForUser(currentUser.id));
        }
    };
    
    if (savedBlogs.length === 0) {
        return <p className="text-gray-500 text-center py-8">You have no saved blog posts.</p>;
    }

    return (
        <ul className="space-y-4">
            {savedBlogs.map(blog => (
                <li key={blog.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-grow">
                        <p className="font-semibold text-sky-800">{blog.blogTitle}</p>
                        <p className="text-sm text-gray-500">Saved on: {new Date(blog.savedAt).toLocaleString()}</p>
                    </div>
                    <div className="space-x-2 flex-shrink-0 self-end sm:self-center">
                        <Button onClick={() => onLoadBlog(blog)} className="bg-sky-600 hover:bg-sky-700 text-white !py-1.5 !px-3">
                            Load
                        </Button>
                        <Button onClick={() => handleDelete(blog.id, blog.blogTitle)} variant="danger" className="!py-1.5 !px-3">
                            <TrashIcon className="w-4 h-4"/>
                        </Button>
                    </div>
                </li>
            ))}
        </ul>
    );
};
    