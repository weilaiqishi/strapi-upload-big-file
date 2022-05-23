import qs from 'qs'
import axios from 'axios'

export type typePagination = {
    page: number, pageSize: number
}

export type typeStrapiFind<T> = {
    data: T[],
    meta: {
        pagination: {
            page: number,
            pageCount: number,
            pageSize: number,
            total: number
        }
    }
}

export type typeStrapiEntity<T> = {
    attributes: T & {
        createdAt: string,
        updatedAt: string,
        publishedAt?: string,
    }
    id: number
}

type typeStrapiEntityBigfile = typeStrapiEntity<{
    text: string
}>
export const strapiNoticeList = async (
    { page, pageSize }:
        Partial<typePagination>
): Promise<typeStrapiFind<typeStrapiEntityBigfile>> => {
    const queryOption = {
        populate: '*',
        pagination: {
            page: page || 1,
            pageSize: pageSize || 10
        },
        sort: ['createdAt:desc']
    }
    const query = qs.stringify(queryOption, {
        encodeValuesOnly: true
    })
    const res = await axios.request<typeStrapiFind<typeStrapiEntityBigfile>>({
        url: `http://localhost:1337/api/bigfiles?${query}`
    })
    return res.data
}