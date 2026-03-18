"""API tests for the posts endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_post_success(client: AsyncClient):
    response = await client.post(
        "/api/v1/posts",
        json={"title": "测试帖子", "content": "这是一条测试内容", "category": "tech"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "测试帖子"
    assert data["category"] == "tech"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_posts_empty(client: AsyncClient):
    response = await client.get("/api/v1/posts")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_and_list_posts(client: AsyncClient):
    await client.post(
        "/api/v1/posts",
        json={"title": "帖子1", "content": "内容1", "category": "news"},
    )
    await client.post(
        "/api/v1/posts",
        json={"title": "帖子2", "content": "内容2", "category": "sports"},
    )
    response = await client.get("/api/v1/posts")
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_get_post_not_found(client: AsyncClient):
    response = await client.get("/api/v1/posts/999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_post(client: AsyncClient):
    create_resp = await client.post(
        "/api/v1/posts",
        json={"title": "原标题", "content": "原内容", "category": "lifestyle"},
    )
    post_id = create_resp.json()["id"]

    update_resp = await client.put(
        f"/api/v1/posts/{post_id}",
        json={"title": "新标题"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "新标题"
    assert update_resp.json()["content"] == "原内容"


@pytest.mark.asyncio
async def test_delete_post(client: AsyncClient):
    create_resp = await client.post(
        "/api/v1/posts",
        json={"title": "待删除", "content": "...", "category": "entertainment"},
    )
    post_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"/api/v1/posts/{post_id}")
    assert delete_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/posts/{post_id}")
    assert get_resp.status_code == 404
